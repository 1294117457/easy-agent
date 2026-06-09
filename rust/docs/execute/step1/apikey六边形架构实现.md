# ApiKey 六边形架构实现

## 1. 目录结构

```
step1/
├── apikey/
│   ├── mod.rs                    # 模块入口
│   ├── entity.rs                 # 实体定义（已在 src-tauri 中存在）
│   ├── port/
│   │   ├── mod.rs
│   │   ├── repository.rs         # 仓储端口（持久化）
│   │   └── service.rs            # 应用服务端口（业务能力）
│   ├── adapter/
│   │   ├── mod.rs
│   │   ├── persistence/
│   │   │   ├── mod.rs
│   │   │   └── sqlite.rs         # SQLite 持久化适配器
│   │   └── crypto/
│   │       ├── mod.rs
│   │       └── aes.rs            # AES 加密适配器
│   └── application/
│       ├── mod.rs
│       ├── apikey_service.rs     # 应用服务实现
│       └── dto.rs                # 数据传输对象
```

## 2. Entity（实体）

已在 `src-tauri/src/domain/apikey/entity.rs` 中实现，核心结构如下：

```rust
// ==================== 包装类型 ====================

/// API Key 唯一标识符（值对象）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ApiKeyId(pub String);

impl ApiKeyId {
    pub fn new() -> Self;
    pub fn from_string(s: String) -> Self;
    pub fn as_str(&self) -> &str;
}

/// LLM 提供商枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LlmProvider {
    OpenAi,
    Anthropic,
    Qwen,
    Groq,
    DeepSeek,
    Gemini,
    Xiaomi,
}

/// API Key 状态枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum KeyStatus {
    Active,
    Inactive,
    Expired,
}

/// API Key 实体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKey {
    pub id: ApiKeyId,
    pub name: String,
    pub encrypted_key: String,          // 加密后的 Key
    pub provider: LlmProvider,
    pub model: String,
    pub base_url: Option<String>,
    pub status: KeyStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

impl ApiKey {
    pub fn new(name, encrypted_key, provider, model) -> Self;
    pub fn reconstitute(...) -> Self;    // 从持久化数据重建
    pub fn is_active(&self) -> bool;
    pub fn activate(&mut self);
    pub fn deactivate(&mut self);
    pub fn mark_expired(&mut self);
    pub fn record_usage(&mut self);
    pub fn set_base_url(&mut self, url: Option<String>);
    pub fn update_model(&mut self, model: String);
    pub fn update_key(&mut self, encrypted_key: String);
}
```

## 3. Port（端口）

### 3.1 仓储端口（repository.rs）

```rust
// src-tauri/src/domain/apikey/port/repository.rs

use crate::domain::apikey::entity::{ApiKey, ApiKeyId, KeyStatus, LlmProvider};

/// ApiKey 仓储端口（属于 driving port）
///
/// 定义对 ApiKey 聚合根的持久化操作契约。
/// 具体实现由 adapter 层注入，六边形内核心业务依赖此接口。
pub trait ApiKeyRepository: Send + Sync {
    /// 根据 ID 查询
    fn find_by_id(&self, id: &ApiKeyId) -> impl Future<Output = Result<Option<ApiKey>, RepoError>> + Send;

    /// 查询所有
    fn find_all(&self) -> impl Future<Output = Result<Vec<ApiKey>, RepoError>> + Send;

    /// 根据 Provider 查询
    fn find_by_provider(&self, provider: LlmProvider) -> impl Future<Output = Result<Vec<ApiKey>, RepoError>> + Send;

    /// 根据状态查询
    fn find_by_status(&self, status: KeyStatus) -> impl Future<Output = Result<Vec<ApiKey>, RepoError>> + Send;

    /// 保存（新建或更新）
    fn save(&self, apikey: &ApiKey) -> impl Future<Output = Result<(), RepoError>> + Send;

    /// 删除
    fn delete(&self, id: &ApiKeyId) -> impl Future<Output = Result<(), RepoError>> + Send;

    /// 获取默认 Key（is_default=true 且 Active）
    fn find_default(&self) -> impl Future<Output = Result<Option<ApiKey>, RepoError>> + Send;
}

/// 仓储层错误类型
#[derive(Debug, thiserror::Error)]
pub enum RepoError {
    #[error("Record not found: {0}")]
    NotFound(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),
}
```

### 3.2 服务端口（service.rs）

```rust
// src-tauri/src/domain/apikey/port/service.rs

use crate::domain::apikey::entity::{ApiKey, ApiKeyId, KeyStatus, LlmProvider};

/// ApiKey 加密服务端口（属于 driving port）
///
/// 定义密钥加密/解密的契约。
/// 具体实现由 adapter 层的 crypto 模块注入。
pub trait CryptoService: Send + Sync {
    /// 加密 API Key
    fn encrypt(&self, plaintext: &str) -> Result<String, CryptoError>;

    /// 解密 API Key
    fn decrypt(&self, ciphertext: &str) -> Result<String, CryptoError>;

    /// 验证 API Key 有效性（通过调用 provider 的 /models 接口）
    fn verify(&self, apikey: &ApiKey) -> impl Future<Output = Result<bool, VerifyError>> + Send;
}

/// 加密错误
#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),

    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),

    #[error("Invalid key length")]
    InvalidKeyLength,
}

/// 验证错误
#[derive(Debug, thiserror::Error)]
pub enum VerifyError {
    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    #[error("Authentication failed")]
    AuthFailed,
}
```

## 4. Adapter（适配器）

### 4.1 持久化适配器（sqlite.rs）

```rust
// src-tauri/src/domain/apikey/adapter/persistence/sqlite.rs

use async_trait::async_trait;
use rusqlite::{params, Connection};

use crate::domain::apikey::entity::{ApiKey, ApiKeyId, KeyStatus, LlmProvider};
use crate::domain::apikey::port::repository::{ApiKeyRepository, RepoError};

/// SQLite 实现的 ApiKey 仓储适配器
pub struct SqliteApiKeyRepository {
    conn: Connection,
}

impl SqliteApiKeyRepository {
    pub fn new(conn: Connection) -> Self {
        Self { conn }
    }

    /// 建表 SQL
    pub fn init_table(&self) -> Result<(), RepoError> {
        self.conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                encrypted_key TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                base_url TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_used_at TEXT
            )
            "#,
            [],
        )
        .map_err(|e| RepoError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    fn map_row(row: &rusqlite::Row) -> Result<ApiKey, rusqlite::Error> {
        Ok(ApiKey {
            id: ApiKeyId(row.column::<String>(0)?),
            name: row.column::<String>(1)?,
            encrypted_key: row.column::<String>(2)?,
            provider: serde_json::from_str(&row.column::<String>(3)?).unwrap_or(LlmProvider::OpenAi),
            model: row.column::<String>(4)?,
            base_url: row.column::<Option<String>>(5)?,
            status: serde_json::from_str(&row.column::<String>(6)?).unwrap_or(KeyStatus::Inactive),
            created_at: row.column::<String>(7)?,
            updated_at: row.column::<String>(8)?,
            last_used_at: row.column::<Option<String>>(9)?,
        })
    }
}

#[async_trait]
impl ApiKeyRepository for SqliteApiKeyRepository {
    async fn find_by_id(&self, id: &ApiKeyId) -> Result<Option<ApiKey>, RepoError> {
        let mut stmt = self.conn.prepare(
            "SELECT id,name,encrypted_key,provider,model,base_url,status,created_at,updated_at,last_used_at FROM api_keys WHERE id = ?"
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        let result = stmt
            .query_row([id.as_str()], Self::map_row)
            .optional()
            .map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        Ok(result)
    }

    async fn find_all(&self) -> Result<Vec<ApiKey>, RepoError> {
        let mut stmt = self.conn.prepare(
            "SELECT id,name,encrypted_key,provider,model,base_url,status,created_at,updated_at,last_used_at FROM api_keys ORDER BY created_at DESC"
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        let rows = stmt
            .query_map([], Self::map_row)
            .map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        let mut apikeys = Vec::new();
        for row in rows {
            apikeys.push(row.map_err(|e| RepoError::DatabaseError(e.to_string()))?);
        }
        Ok(apikeys)
    }

    async fn find_by_provider(&self, provider: LlmProvider) -> Result<Vec<ApiKey>, RepoError> {
        let provider_str = serde_json::to_string(&provider).unwrap();
        let mut stmt = self.conn.prepare(
            "SELECT ... FROM api_keys WHERE provider = ?"
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        let rows = stmt
            .query_map([provider_str.as_str()], Self::map_row)
            .map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        let mut apikeys = Vec::new();
        for row in rows {
            apikeys.push(row.map_err(|e| RepoError::DatabaseError(e.to_string()))?);
        }
        Ok(apikeys)
    }

    async fn find_by_status(&self, status: KeyStatus) -> Result<Vec<ApiKey>, RepoError> {
        let status_str = serde_json::to_string(&status).unwrap();
        // ... 类似实现
        todo!()
    }

    async fn save(&self, apikey: &ApiKey) -> Result<(), RepoError> {
        let provider_str = serde_json::to_string(&apikey.provider).unwrap();
        let status_str = serde_json::to_string(&apikey.status).unwrap();

        self.conn.execute(
            r#"
            INSERT INTO api_keys (id,name,encrypted_key,provider,model,base_url,status,created_at,updated_at,last_used_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                encrypted_key=excluded.encrypted_key,
                provider=excluded.provider,
                model=excluded.model,
                base_url=excluded.base_url,
                status=excluded.status,
                updated_at=excluded.updated_at,
                last_used_at=excluded.last_used_at
            "#,
            params![
                apikey.id.as_str(),
                apikey.name,
                apikey.encrypted_key,
                provider_str,
                apikey.model,
                apikey.base_url,
                status_str,
                apikey.created_at.to_rfc3339(),
                apikey.updated_at.to_rfc3339(),
                apikey.last_used_at.map(|dt| dt.to_rfc3339()),
            ],
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn delete(&self, id: &ApiKeyId) -> Result<(), RepoError> {
        self.conn.execute(
            "DELETE FROM api_keys WHERE id = ?",
            [id.as_str()],
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    async fn find_default(&self) -> Result<Option<ApiKey>, RepoError> {
        let mut stmt = self.conn.prepare(
            "SELECT ... FROM api_keys WHERE status = 'active' LIMIT 1"
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        let result = stmt
            .query_row([], Self::map_row)
            .optional()
            .map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        Ok(result)
    }
}
```

### 4.2 加密适配器（aes.rs）

```rust
// src-tauri/src/domain/apikey/adapter/crypto/aes.rs

use aes::Aes256;
use cbc::{Encryptor, Decryptor, cipher::{BlockEncryptMut, BlockDecryptMut, KeyIvInit}};
use rand::Rng;

use crate::domain::apikey::port::service::{CryptoService, CryptoError};

type Aes256CbcEnc = Encryptor<Aes256>;
type Aes256CbcDec = Decryptor<Aes256>;

const KEY_SIZE: usize = 32; // AES-256
const IV_SIZE: usize = 16;  // CBC mode

/// AES-256-CBC 加密服务实现
pub struct AesCryptoAdapter {
    key: [u8; KEY_SIZE],
}

impl AesCryptoAdapter {
    /// 从环境变量或配置文件加载密钥
    pub fn from_env() -> Result<Self, CryptoError> {
        let key_str = std::env::var("API_KEY_ENCRYPTION_KEY")
            .map_err(|_| CryptoError::EncryptionFailed("Missing API_KEY_ENCRYPTION_KEY".into()))?;

        let key_bytes = base64::decode(&key_str)
            .map_err(|_| CryptoError::InvalidKeyLength)?;

        if key_bytes.len() != KEY_SIZE {
            return Err(CryptoError::InvalidKeyLength);
        }

        let mut key = [0u8; KEY_SIZE];
        key.copy_from_slice(&key_bytes);
        Ok(Self { key })
    }

    /// 使用固定密钥（仅开发环境）
    #[cfg(test)]
    pub fn with_test_key() -> Self {
        let key = [0u8; KEY_SIZE];
        Self { key }
    }
}

impl CryptoService for AesCryptoAdapter {
    fn encrypt(&self, plaintext: &str) -> Result<String, CryptoError> {
        let mut rng = rand::thread_rng();
        let mut iv = [0u8; IV_SIZE];
        rng.fill(&mut iv);

        let cipher = Aes256CbcEnc::new(&self.key.into(), &iv.into());
        let mut buf = vec![0u8; (plaintext.len() + 15) & !15];
        buf[..plaintext.len()].copy_from_slice(plaintext.as_bytes());

        cipher
            .encrypt_padded_blocks_mut::<aes::cipher::block_padding::Pkcs7>(&mut buf)
            .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

        // 拼接 IV + 密文，再做 base64
        let mut combined = iv.to_vec();
        combined.extend(buf);
        Ok(base64::encode(&combined))
    }

    fn decrypt(&self, ciphertext: &str) -> Result<String, CryptoError> {
        let combined = base64::decode(ciphertext)
            .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))?;

        if combined.len() < IV_SIZE {
            return Err(CryptoError::DecryptionFailed("Data too short".into()));
        }

        let (iv, encrypted) = combined.split_at(IV_SIZE);
        let mut iv_arr = [0u8; IV_SIZE];
        iv_arr.copy_from_slice(iv);

        let mut buf = encrypted.to_vec();
        let cipher = Aes256CbcDec::new(&self.key.into(), &iv_arr.into());

        cipher
            .decrypt_padded_blocks_mut::<aes::cipher::block_padding::Pkcs7>(&mut buf)
            .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))?;

        String::from_utf8(buf).map_err(|e| CryptoError::DecryptionFailed(e.to_string()))
    }

    async fn verify(&self, apikey: &ApiKey) -> Result<bool, VerifyError> {
        use reqwest;
        use std::time::Duration;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|e| VerifyError::NetworkError(e.to_string()))?;

        let base_url = apikey.base_url.as_deref()
            .unwrap_or(match apikey.provider {
                LlmProvider::OpenAi => "https://api.openai.com",
                LlmProvider::Anthropic => "https://api.anthropic.com",
                _ => "https://api.openai.com",
            });

        let response = client
            .get(format!("{}/v1/models", base_url))
            .header("Authorization", format!("Bearer {}", self.decrypt(&apikey.encrypted_key)?))
            .send()
            .await
            .map_err(|e| VerifyError::NetworkError(e.to_string()))?;

        match response.status().as_u16() {
            200 => Ok(true),
            401 | 403 => Err(VerifyError::AuthFailed),
            _ => Err(VerifyError::InvalidResponse(format!("status: {}", response.status()))),
        }
    }
}
```

## 5. Application（应用层）

### 5.1 DTO（dto.rs）

```rust
// src-tauri/src/domain/apikey/application/dto.rs

use serde::{Deserialize, Serialize};
use crate::domain::apikey::entity::{ApiKeyId, KeyStatus, LlmProvider};

/// 创建 API Key 的请求 DTO
#[derive(Debug, Deserialize)]
pub struct CreateApiKeyDto {
    pub name: String,
    pub api_key: String,         // 明文 Key（由前端传入）
    pub provider: LlmProvider,
    pub model: String,
    pub base_url: Option<String>,
}

/// 更新 API Key 的请求 DTO
#[derive(Debug, Deserialize)]
pub struct UpdateApiKeyDto {
    pub name: Option<String>,
    pub api_key: Option<String>, // 明文 Key
    pub model: Option<String>,
    pub base_url: Option<String>,
    pub status: Option<KeyStatus>,
}

/// API Key 响应 DTO（对外不暴露加密后的 key）
#[derive(Debug, Serialize)]
pub struct ApiKeyResponseDto {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
    pub status: String,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_used_at: Option<String>,
}

impl From<&ApiKey> for ApiKeyResponseDto {
    fn from(apikey: &ApiKey) -> Self {
        Self {
            id: apikey.id.as_str().to_string(),
            name: apikey.name.clone(),
            provider: apikey.provider.as_str().to_string(),
            model: apikey.model.clone(),
            base_url: apikey.base_url.clone(),
            status: format!("{:?}", apikey.status),
            is_active: apikey.is_active(),
            created_at: apikey.created_at.to_rfc3339(),
            updated_at: apikey.updated_at.to_rfc3339(),
            last_used_at: apikey.last_used_at.map(|dt| dt.to_rfc3339()),
        }
    }
}
```

### 5.2 应用服务（apikey_service.rs）

```rust
// src-tauri/src/domain/apikey/application/apikey_service.rs

use std::sync::Arc;
use thiserror::Error;

use crate::domain::apikey::entity::{ApiKey, ApiKeyId, LlmProvider};
use crate::domain::apikey::port::repository::{ApiKeyRepository, RepoError};
use crate::domain::apikey::port::service::CryptoService;
use crate::domain::apikey::application::dto::{
    CreateApiKeyDto, UpdateApiKeyDto, ApiKeyResponseDto,
};

/// ApiKey 应用服务
///
/// 协调 Repository 和 CryptoService，处理业务逻辑。
/// 由 Tauri 命令（driving adapter）调用。
pub struct ApiKeyService {
    repository: Arc<dyn ApiKeyRepository>,
    crypto: Arc<dyn CryptoService>,
}

#[derive(Debug, Error)]
pub enum ApiKeyServiceError {
    #[error("Repository error: {0}")]
    RepoError(#[from] RepoError),

    #[error("Crypto error: {0}")]
    CryptoError(String),

    #[error("ApiKey not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

impl ApiKeyService {
    pub fn new(
        repository: Arc<dyn ApiKeyRepository>,
        crypto: Arc<dyn CryptoService>,
    ) -> Self {
        Self { repository, crypto }
    }

    /// 创建新的 API Key
    pub async fn create(&self, dto: CreateApiKeyDto) -> Result<ApiKeyResponseDto, ApiKeyServiceError> {
        // 1. 加密明文 Key
        let encrypted_key = self.crypto
            .encrypt(&dto.api_key)
            .map_err(ApiKeyServiceError::CryptoError)?;

        // 2. 构建实体
        let mut apikey = ApiKey::new(
            dto.name,
            encrypted_key,
            dto.provider,
            dto.model,
        );
        apikey.set_base_url(dto.base_url);

        // 3. 持久化
        self.repository
            .save(&apikey)
            .await?;

        Ok(ApiKeyResponseDto::from(&apikey))
    }

    /// 根据 ID 查询
    pub async fn find_by_id(&self, id: &str) -> Result<Option<ApiKeyResponseDto>, ApiKeyServiceError> {
        let apikey = self.repository
            .find_by_id(&ApiKeyId::from_string(id.to_string()))
            .await?
            .ok_or_else(|| ApiKeyServiceError::NotFound(id.to_string()))?;

        Ok(Some(ApiKeyResponseDto::from(&apikey)))
    }

    /// 查询所有
    pub async fn find_all(&self) -> Result<Vec<ApiKeyResponseDto>, ApiKeyServiceError> {
        let apikeys = self.repository.find_all().await?;
        Ok(apikeys.iter().map(ApiKeyResponseDto::from).collect())
    }

    /// 更新 API Key
    pub async fn update(&self, id: &str, dto: UpdateApiKeyDto) -> Result<ApiKeyResponseDto, ApiKeyServiceError> {
        let mut apikey = self.repository
            .find_by_id(&ApiKeyId::from_string(id.to_string()))
            .await?
            .ok_or_else(|| ApiKeyServiceError::NotFound(id.to_string()))?;

        if let Some(name) = dto.name {
            apikey.name = name;
            apikey.updated_at = chrono::Utc::now();
        }

        if let Some(model) = dto.model {
            apikey.update_model(model);
        }

        if let Some(base_url) = dto.base_url {
            apikey.set_base_url(Some(base_url));
        }

        if let Some(status) = dto.status {
            match status {
                KeyStatus::Active => apikey.activate(),
                KeyStatus::Inactive => apikey.deactivate(),
                KeyStatus::Expired => apikey.mark_expired(),
            }
        }

        if let Some(api_key) = dto.api_key {
            let encrypted_key = self.crypto
                .encrypt(&api_key)
                .map_err(ApiKeyServiceError::CryptoError)?;
            apikey.update_key(encrypted_key);
        }

        self.repository.save(&apikey).await?;
        Ok(ApiKeyResponseDto::from(&apikey))
    }

    /// 删除 API Key
    pub async fn delete(&self, id: &str) -> Result<(), ApiKeyServiceError> {
        self.repository
            .delete(&ApiKeyId::from_string(id.to_string()))
            .await?;
        Ok(())
    }

    /// 验证 API Key 有效性
    pub async fn verify(&self, id: &str) -> Result<bool, ApiKeyServiceError> {
        let apikey = self.repository
            .find_by_id(&ApiKeyId::from_string(id.to_string()))
            .await?
            .ok_or_else(|| ApiKeyServiceError::NotFound(id.to_string()))?;

        self.crypto.verify(&apikey).await
            .map_err(|e| ApiKeyServiceError::CryptoError(e.to_string()))
    }

    /// 获取可用的默认 Key
    pub async fn get_default(&self) -> Result<Option<ApiKeyResponseDto>, ApiKeyServiceError> {
        let apikey = self.repository.find_default().await?;
        Ok(apikey.map(|ak| ApiKeyResponseDto::from(&ak)))
    }

    /// 记录 Key 使用（更新 last_used_at）
    pub async fn record_usage(&self, id: &str) -> Result<(), ApiKeyServiceError> {
        let mut apikey = self.repository
            .find_by_id(&ApiKeyId::from_string(id.to_string()))
            .await?
            .ok_or_else(|| ApiKeyServiceError::NotFound(id.to_string()))?;

        apikey.record_usage();
        self.repository.save(&apikey).await?;
        Ok(())
    }
}
```

### 5.3 模块入口（mod.rs）

```rust
// src-tauri/src/domain/apikey/mod.rs

pub mod entity;
pub mod port;
pub mod adapter;
pub mod application;

// 重新导出主要类型，方便上层调用
pub use entity::{ApiKey, ApiKeyId, LlmProvider, KeyStatus};
pub use port::repository::ApiKeyRepository;
pub use port::service::CryptoService;
pub use application::apikey_service::ApiKeyService;
pub use application::dto::{CreateApiKeyDto, UpdateApiKeyDto, ApiKeyResponseDto};
```

## 6. 六边形架构全貌

```
                        ┌─────────────────────────────────────────────┐
                        │              Driving Adapter                  │
                        │  (Tauri Commands / HTTP API / IPC)          │
                        └────────────────────┬────────────────────────┘
                                             │
                                             ▼
                        ┌─────────────────────────────────────────────┐
                        │              Application                     │
                        │          ApiKeyService                       │
                        │  • 编排业务逻辑  • DTO 转换                  │
                        └────────────────────┬────────────────────────┘
                                             │
                         ┌───────────────────┴───────────────────┐
                         │           Port（端口）                 │
                         │  ApiKeyRepository   CryptoService    │
                         └───────────────────┬───────────────────┘
                                             │
                        ┌────────────────────┴────────────────────┐
                        │             Adapter（适配器）             │
                        │  SqliteApiKeyRepository  AesCrypto      │
                        └────────────────────┬────────────────────┘
                                             │
                        ┌────────────────────┴────────────────────┐
                        │           Driven Adapter                   │
                        │  (SQLite Database  /  OS / External API)  │
                        └───────────────────────────────────────────┘
```

### 依赖方向（依赖倒置）

- **Application** 依赖 **Port**（接口），不依赖具体实现
- **Adapter** 实现 **Port**（接口），注入到 Application
- **Entity** 被所有层引用，但不含外部依赖（纯净领域模型）
