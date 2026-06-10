# ApiKey 六边形架构实现

## 1. 名词解释：InputPort vs OutputPort

| 端口类型 | 含义 | 方向 | 调用者 |
|---|---|---|---|
| **InputPort**（ Driving Port） | 核心域暴露给外部的接口 | 外部 → 核心 | Tauri Commands / Agent / Graph |
| **OutputPort**（Driven Port） | 核心域需要外部能力时的接口 | 核心 → 外部 | Application Service |

```
Tauri Commands / Agent / Graph
        │
        │  ← 调用 InputPort（外部驱动核心）
        ▼
  ┌─────────────────────────────────┐
  │          Application            │
  │   （编排 InputPort + OutputPort）│
  └───────────┬─────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
InputPort           OutputPort
（定义能力）         （定义依赖）
    │                   │
    │                   ▼
    │          ┌────────────────┐
    │          │    Adapter     │
    │          │（实现 OutputPort）│
    │          └────────┬───────┘
    │                   │
    └──────┬────────────┘
           ▼
    ┌──────────────────┐
    │  Domain / Entity │
    └──────────────────┘
```

## 2. 目录结构

```
src-tauri/src/
├── domain/
│   └── apikey/
│       ├── mod.rs              # 模块入口
│       ├── ApikeyEntity.rs     # 实体
│       ├── ApikeyInputPort.rs  # 输入端口（外部驱动核心的接口）
│       └── ApikeyOutputPort.rs # 输出端口（核心依赖外部能力的接口）
├── application/
│   └── apikey/
│       ├── mod.rs
│       └── ApikeyApplication.rs  # 应用服务（实现 InputPort，调用 OutputPort）
├── infra/
│   ├── persistence/
│   │   ├── mod.rs
│   │   └── sqlite.rs            # SQLite 基础设施
│   └── apikey/
│       ├── mod.rs
│       ├── ApikeyInputAdapter.rs   # 输入适配器（Tauri Commands 调用 InputPort）
│       └── ApikeyOutputAdapter.rs  # 输出适配器（实现 OutputPort，供 Application 注入）
```

## 3. Domain（领域层）

### 3.1 Entity（ApikeyEntity.rs）

```rust
// src-tauri/src/domain/apikey/ApikeyEntity.rs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ==================== 值对象 ====================

/// API Key 唯一标识符（值对象）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ApiKeyId(pub String);

impl ApiKeyId {
    pub fn new() -> Self {
        Self(Uuid::new_v4().to_string())
    }

    pub fn from_string(s: String) -> Self {
        Self(s)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl Default for ApiKeyId {
    fn default() -> Self {
        Self::new()
    }
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

impl LlmProvider {
    pub fn as_str(&self) -> &'static str {
        match self {
            LlmProvider::OpenAi => "openai",
            LlmProvider::Anthropic => "anthropic",
            LlmProvider::Qwen => "qwen",
            LlmProvider::Groq => "groq",
            LlmProvider::DeepSeek => "deepseek",
            LlmProvider::Gemini => "gemini",
            LlmProvider::Xiaomi => "xiaomi",
        }
    }
}

/// API Key 状态枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum KeyStatus {
    Active,
    Inactive,
    Expired,
}

// ==================== 实体 ====================

/// API Key 实体
///
/// 代表一个 LLM API Key，包含加密存储的密钥和元信息。
/// 包含加密后的 key，永不在输出中暴露明文。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKey {
    pub id: ApiKeyId,
    pub name: String,
    /// 加密后的 Key（存储时不暴露明文）
    pub encrypted_key: String,
    pub provider: LlmProvider,
    pub model: String,
    pub base_url: Option<String>,
    pub status: KeyStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

impl ApiKey {
    // ============ 构造函数 ============

    pub fn new(
        name: String,
        encrypted_key: String,
        provider: LlmProvider,
        model: String,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: ApiKeyId::new(),
            name,
            encrypted_key,
            provider,
            model,
            base_url: None,
            status: KeyStatus::Active,
            created_at: now,
            updated_at: now,
            last_used_at: None,
        }
    }

    /// 从持久化数据重建（用于从数据库加载）
    pub fn reconstitute(
        id: ApiKeyId,
        name: String,
        encrypted_key: String,
        provider: LlmProvider,
        model: String,
        base_url: Option<String>,
        status: KeyStatus,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
        last_used_at: Option<DateTime<Utc>>,
    ) -> Self {
        Self {
            id,
            name,
            encrypted_key,
            provider,
            model,
            base_url,
            status,
            created_at,
            updated_at,
            last_used_at,
        }
    }

    // ============ 业务方法 ============

    pub fn is_active(&self) -> bool {
        self.status == KeyStatus::Active
    }

    pub fn activate(&mut self) {
        self.status = KeyStatus::Active;
        self.updated_at = Utc::now();
    }

    pub fn deactivate(&mut self) {
        self.status = KeyStatus::Inactive;
        self.updated_at = Utc::now();
    }

    pub fn mark_expired(&mut self) {
        self.status = KeyStatus::Expired;
        self.updated_at = Utc::now();
    }

    pub fn record_usage(&mut self) {
        self.last_used_at = Some(Utc::now());
        self.updated_at = Utc::now();
    }

    pub fn set_base_url(&mut self, url: Option<String>) {
        self.base_url = url;
        self.updated_at = Utc::now();
    }

    pub fn update_model(&mut self, model: String) {
        self.model = model;
        self.updated_at = Utc::now();
    }

    pub fn update_key(&mut self, encrypted_key: String) {
        self.encrypted_key = encrypted_key;
        self.updated_at = Utc::now();
    }
}
```

### 3.2 InputPort（ApikeyInputPort.rs）

InputPort 是**核心域暴露给外部调用的接口**，由 Application 层实现。

```rust
// src-tauri/src/domain/apikey/ApikeyInputPort.rs

use crate::domain::apikey::ApikeyEntity::{ApiKey, ApiKeyId, KeyStatus, LlmProvider};
use crate::domain::apikey::application::ApikeyApplication;

/// ApiKey 输入端口（Driving Port / InputPort）
///
/// 定义外部（Command / Agent / Graph）可以调用核心域能力的接口契约。
/// 由 Application 层（ApikeyApplication）实现。
pub trait ApikeyInputPort: Send + Sync {
    /// 创建 API Key
    async fn create(
        &self,
        name: String,
        api_key: String,
        provider: LlmProvider,
        model: String,
        base_url: Option<String>,
    ) -> Result<ApiKey, ApikeyInputError>;

    /// 根据 ID 获取
    async fn get_by_id(&self, id: &str) -> Result<Option<ApiKey>, ApikeyInputError>;

    /// 获取所有
    async fn list_all(&self) -> Result<Vec<ApiKey>, ApikeyInputError>;

    /// 获取默认 Key
    async fn get_default(&self) -> Result<Option<ApiKey>, ApikeyInputError>;

    /// 更新 API Key
    async fn update(
        &self,
        id: &str,
        name: Option<String>,
        api_key: Option<String>,
        model: Option<String>,
        base_url: Option<String>,
        status: Option<KeyStatus>,
    ) -> Result<ApiKey, ApikeyInputError>;

    /// 删除 API Key
    async fn delete(&self, id: &str) -> Result<(), ApikeyInputError>;

    /// 验证 API Key 有效性
    async fn verify(&self, id: &str) -> Result<bool, ApikeyInputError>;

    /// 记录使用时间
    async fn record_usage(&self, id: &str) -> Result<(), ApikeyInputError>;
}

/// 输入端口错误类型
#[derive(Debug, thiserror::Error)]
pub enum ApikeyInputError {
    #[error("Crypto error: {0}")]
    CryptoError(String),

    #[error("Repository error: {0}")]
    RepoError(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Verification failed: {0}")]
    VerifyFailed(String),
}
```

### 3.3 OutputPort（ApikeyOutputPort.rs）

OutputPort 是**核心域需要外部能力时的接口契约**，由 Adapter 层实现并注入。

```rust
// src-tauri/src/domain/apikey/ApikeyOutputPort.rs

use crate::domain::apikey::ApikeyEntity::{ApiKey, ApiKeyId, KeyStatus, LlmProvider};

/// ApiKey 仓储输出端口（Driven Port / OutputPort）
///
/// 定义持久化能力的接口契约。
/// 由 Adapter 层（SqliteApikeyOutputAdapter）实现并注入到 Application。
pub trait ApikeyRepositoryOutputPort: Send + Sync {
    fn find_by_id(&self, id: &ApiKeyId) -> impl Future<Output = Result<Option<ApiKey>, ApikeyRepoError>> + Send;

    fn find_all(&self) -> impl Future<Output = Result<Vec<ApiKey>, ApikeyRepoError>> + Send;

    fn find_by_provider(&self, provider: LlmProvider) -> impl Future<Output = Result<Vec<ApiKey>, ApikeyRepoError>> + Send;

    fn find_by_status(&self, status: KeyStatus) -> impl Future<Output = Result<Vec<ApiKey>, ApikeyRepoError>> + Send;

    fn save(&self, apikey: &ApiKey) -> impl Future<Output = Result<(), ApikeyRepoError>> + Send;

    fn delete(&self, id: &ApiKeyId) -> impl Future<Output = Result<(), ApikeyRepoError>> + Send;

    fn find_default(&self) -> impl Future<Output = Result<Option<ApiKey>, ApikeyRepoError>> + Send;
}

/// 仓储层错误
#[derive(Debug, thiserror::Error)]
pub enum ApikeyRepoError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),
}

/// 加密服务输出端口（Driven Port / OutputPort）
///
/// 定义加密/解密能力的接口契约。
/// 由 Adapter 层（AesCryptoOutputAdapter）实现并注入到 Application。
pub trait CryptoServiceOutputPort: Send + Sync {
    /// 加密明文 Key
    fn encrypt(&self, plaintext: &str) -> Result<String, CryptoError>;

    /// 解密密文 Key
    fn decrypt(&self, ciphertext: &str) -> Result<String, CryptoError>;

    /// 验证 API Key 有效性（通过调用 Provider 的 /models 接口）
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

### 3.4 mod.rs（domain/apikey）

```rust
// src-tauri/src/domain/apikey/mod.rs

pub mod ApikeyEntity;
pub mod ApikeyInputPort;
pub mod ApikeyOutputPort;

pub use ApikeyEntity::{ApiKey, ApiKeyId, KeyStatus, LlmProvider};
pub use ApikeyInputPort::{ApikeyInputPort, ApikeyInputError};
pub use ApikeyOutputPort::{
    ApikeyRepositoryOutputPort, ApikeyRepoError,
    CryptoServiceOutputPort, CryptoError, VerifyError,
};
```

## 4. Application（应用层）

### 4.1 Application（ApikeyApplication.rs）

```rust
// src-tauri/src/application/apikey/ApikeyApplication.rs

use std::sync::Arc;
use thiserror::Error;

use crate::domain::apikey::{
    ApiKey, ApiKeyId, KeyStatus, LlmProvider,
    ApikeyInputPort, ApikeyInputError,
    ApikeyRepositoryOutputPort, ApikeyRepoError,
    CryptoServiceOutputPort, CryptoError, VerifyError,
};

/// ApiKey 应用服务
///
/// 实现 ApikeyInputPort，编排 ApikeyRepositoryOutputPort 和 CryptoServiceOutputPort。
/// 由 Tauri Commands（InputAdapter）调用。
pub struct ApikeyApplication {
    repository: Arc<dyn ApikeyRepositoryOutputPort>,
    crypto: Arc<dyn CryptoServiceOutputPort>,
}

impl ApikeyApplication {
    pub fn new(
        repository: Arc<dyn ApikeyRepositoryOutputPort>,
        crypto: Arc<dyn CryptoServiceOutputPort>,
    ) -> Self {
        Self { repository, crypto }
    }

    fn map_repo_error(e: ApikeyRepoError) -> ApikeyInputError {
        ApikeyInputError::RepoError(e.to_string())
    }
}

impl ApikeyInputPort for ApikeyApplication {
    async fn create(
        &self,
        name: String,
        api_key: String,
        provider: LlmProvider,
        model: String,
        base_url: Option<String>,
    ) -> Result<ApiKey, ApikeyInputError> {
        let encrypted_key = self.crypto
            .encrypt(&api_key)
            .map_err(|e| ApikeyInputError::CryptoError(e.to_string()))?;

        let mut apikey = ApiKey::new(name, encrypted_key, provider, model);
        apikey.set_base_url(base_url);

        self.repository.save(&apikey)
            .await
            .map_err(Self::map_repo_error)?;

        Ok(apikey)
    }

    async fn get_by_id(&self, id: &str) -> Result<Option<ApiKey>, ApikeyInputError> {
        self.repository
            .find_by_id(&ApiKeyId::from_string(id.to_string()))
            .await
            .map_err(Self::map_repo_error)
    }

    async fn list_all(&self) -> Result<Vec<ApiKey>, ApikeyInputError> {
        self.repository.find_all()
            .await
            .map_err(Self::map_repo_error)
    }

    async fn get_default(&self) -> Result<Option<ApiKey>, ApikeyInputError> {
        self.repository.find_default()
            .await
            .map_err(Self::map_repo_error)
    }

    async fn update(
        &self,
        id: &str,
        name: Option<String>,
        api_key: Option<String>,
        model: Option<String>,
        base_url: Option<String>,
        status: Option<KeyStatus>,
    ) -> Result<ApiKey, ApikeyInputError> {
        let mut apikey = self.repository
            .find_by_id(&ApiKeyId::from_string(id.to_string()))
            .await
            .map_err(Self::map_repo_error)?
            .ok_or_else(|| ApikeyInputError::NotFound(id.to_string()))?;

        if let Some(n) = name {
            apikey.name = n;
            apikey.updated_at = chrono::Utc::now();
        }

        if let Some(m) = model {
            apikey.update_model(m);
        }

        if let Some(url) = base_url {
            apikey.set_base_url(Some(url));
        }

        if let Some(s) = status {
            match s {
                KeyStatus::Active => apikey.activate(),
                KeyStatus::Inactive => apikey.deactivate(),
                KeyStatus::Expired => apikey.mark_expired(),
            }
        }

        if let Some(k) = api_key {
            let encrypted = self.crypto
                .encrypt(&k)
                .map_err(|e| ApikeyInputError::CryptoError(e.to_string()))?;
            apikey.update_key(encrypted);
        }

        self.repository.save(&apikey)
            .await
            .map_err(Self::map_repo_error)?;

        Ok(apikey)
    }

    async fn delete(&self, id: &str) -> Result<(), ApikeyInputError> {
        self.repository
            .delete(&ApiKeyId::from_string(id.to_string()))
            .await
            .map_err(Self::map_repo_error)
    }

    async fn verify(&self, id: &str) -> Result<bool, ApikeyInputError> {
        let apikey = self.repository
            .find_by_id(&ApiKeyId::from_string(id.to_string()))
            .await
            .map_err(Self::map_repo_error)?
            .ok_or_else(|| ApikeyInputError::NotFound(id.to_string()))?;

        self.crypto.verify(&apikey)
            .await
            .map_err(|e| ApikeyInputError::VerifyFailed(e.to_string()))
    }

    async fn record_usage(&self, id: &str) -> Result<(), ApikeyInputError> {
        let mut apikey = self.repository
            .find_by_id(&ApiKeyId::from_string(id.to_string()))
            .await
            .map_err(Self::map_repo_error)?
            .ok_or_else(|| ApikeyInputError::NotFound(id.to_string()))?;

        apikey.record_usage();
        self.repository.save(&apikey)
            .await
            .map_err(Self::map_repo_error)
    }
}
```

### 4.2 mod.rs（application/apikey）

```rust
// src-tauri/src/application/apikey/mod.rs

pub mod ApikeyApplication;

pub use ApikeyApplication::ApikeyApplication;
```

## 5. Infra（基础设施层）

### 5.1 OutputAdapter（ApikeyOutputAdapter.rs）

实现 `ApikeyRepositoryOutputPort`（持久化）和 `CryptoServiceOutputPort`（加密）。

```rust
// src-tauri/src/infra/apikey/ApikeyOutputAdapter.rs

use async_trait::async_trait;
use rusqlite::{params, Connection};
use std::sync::Arc;

use crate::domain::apikey::{
    ApiKey, ApiKeyId, KeyStatus, LlmProvider,
    ApikeyRepositoryOutputPort, ApikeyRepoError,
    CryptoServiceOutputPort, CryptoError, VerifyError,
};

// ==================== Repository Output Adapter ====================

/// SQLite 实现的 ApiKey 仓储适配器（OutputAdapter）
pub struct SqliteApikeyRepositoryOutputAdapter {
    conn: Arc<Connection>,
}

impl SqliteApikeyRepositoryOutputAdapter {
    pub fn new(conn: Arc<Connection>) -> Self {
        Self { conn }
    }

    pub fn init_table(&self) -> Result<(), ApikeyRepoError> {
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
        ).map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    fn map_row(row: &rusqlite::Row) -> Result<ApiKey, rusqlite::Error> {
        Ok(ApiKey {
            id: ApiKeyId(row.column::<String>(0)?),
            name: row.column::<String>(1)?,
            encrypted_key: row.column::<String>(2)?,
            provider: serde_json::from_str(&row.column::<String>(3)?)
                .unwrap_or(LlmProvider::OpenAi),
            model: row.column::<String>(4)?,
            base_url: row.column::<Option<String>>(5)?,
            status: serde_json::from_str(&row.column::<String>(6)?)
                .unwrap_or(KeyStatus::Inactive),
            created_at: row.column::<String>(7)?.parse().unwrap_or_default(),
            updated_at: row.column::<String>(8)?.parse().unwrap_or_default(),
            last_used_at: row.column::<Option<String>>(9)?,
        })
    }
}

#[async_trait]
impl ApikeyRepositoryOutputPort for SqliteApikeyRepositoryOutputAdapter {
    async fn find_by_id(&self, id: &ApiKeyId) -> Result<Option<ApiKey>, ApikeyRepoError> {
        let conn = self.conn.clone();
        let id_str = id.as_str().to_string();

        tokio::task::spawn_blocking(move || {
            let mut stmt = conn.prepare(
                "SELECT id,name,encrypted_key,provider,model,base_url,status,created_at,updated_at,last_used_at
                 FROM api_keys WHERE id = ?"
            ).map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?;

            stmt.query_row([&id_str], Self::map_row)
                .optional()
                .map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))
        }).await.map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?
    }

    async fn find_all(&self) -> Result<Vec<ApiKey>, ApikeyRepoError> {
        let conn = self.conn.clone();

        tokio::task::spawn_blocking(move || {
            let mut stmt = conn.prepare(
                "SELECT id,name,encrypted_key,provider,model,base_url,status,created_at,updated_at,last_used_at
                 FROM api_keys ORDER BY created_at DESC"
            ).map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?;

            let rows = stmt.query_map([], Self::map_row)
                .map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?;

            let mut keys = Vec::new();
            for row in rows {
                keys.push(row.map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?);
            }
            Ok(keys)
        }).await.map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?
    }

    async fn find_by_provider(&self, provider: LlmProvider) -> Result<Vec<ApiKey>, ApikeyRepoError> {
        let conn = self.conn.clone();
        let provider_str = serde_json::to_string(&provider).unwrap();

        tokio::task::spawn_blocking(move || {
            let mut stmt = conn.prepare(
                "SELECT id,name,encrypted_key,provider,model,base_url,status,created_at,updated_at,last_used_at
                 FROM api_keys WHERE provider = ?"
            ).map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?;

            let rows = stmt.query_map([&provider_str], Self::map_row)
                .map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?;

            let mut keys = Vec::new();
            for row in rows {
                keys.push(row.map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?);
            }
            Ok(keys)
        }).await.map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?
    }

    async fn find_by_status(&self, status: KeyStatus) -> Result<Vec<ApiKey>, ApikeyRepoError> {
        let conn = self.conn.clone();
        let status_str = serde_json::to_string(&status).unwrap();

        tokio::task::spawn_blocking(move || {
            let mut stmt = conn.prepare(
                "SELECT ... FROM api_keys WHERE status = ?"
            ).map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?;

            let rows = stmt.query_map([&status_str], Self::map_row)
                .map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?;

            let mut keys = Vec::new();
            for row in rows {
                keys.push(row.map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?);
            }
            Ok(keys)
        }).await.map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?
    }

    async fn save(&self, apikey: &ApiKey) -> Result<(), ApikeyRepoError> {
        let conn = self.conn.clone();
        let provider_str = serde_json::to_string(&apikey.provider).unwrap();
        let status_str = serde_json::to_string(&apikey.status).unwrap();
        let apikey_clone = apikey.clone();

        tokio::task::spawn_blocking(move || {
            conn.execute(
                r#"
                INSERT INTO api_keys (id,name,encrypted_key,provider,model,base_url,status,created_at,updated_at,last_used_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name, encrypted_key=excluded.encrypted_key,
                    provider=excluded.provider, model=excluded.model,
                    base_url=excluded.base_url, status=excluded.status,
                    updated_at=excluded.updated_at, last_used_at=excluded.last_used_at
                "#,
                params![
                    apikey_clone.id.as_str(),
                    apikey_clone.name,
                    apikey_clone.encrypted_key,
                    provider_str,
                    apikey_clone.model,
                    apikey_clone.base_url,
                    status_str,
                    apikey_clone.created_at.to_rfc3339(),
                    apikey_clone.updated_at.to_rfc3339(),
                    apikey_clone.last_used_at.map(|dt| dt.to_rfc3339()),
                ],
            ).map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?;
            Ok(())
        }).await.map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?
    }

    async fn delete(&self, id: &ApiKeyId) -> Result<(), ApikeyRepoError> {
        let conn = self.conn.clone();
        let id_str = id.as_str().to_string();

        tokio::task::spawn_blocking(move || {
            conn.execute("DELETE FROM api_keys WHERE id = ?", [&id_str])
                .map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?;
            Ok(())
        }).await.map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?
    }

    async fn find_default(&self) -> Result<Option<ApiKey>, ApikeyRepoError> {
        let conn = self.conn.clone();

        tokio::task::spawn_blocking(move || {
            let mut stmt = conn.prepare(
                "SELECT id,name,encrypted_key,provider,model,base_url,status,created_at,updated_at,last_used_at
                 FROM api_keys WHERE status = 'active' LIMIT 1"
            ).map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?;

            stmt.query_row([], Self::map_row)
                .optional()
                .map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))
        }).await.map_err(|e| ApikeyRepoError::DatabaseError(e.to_string()))?
    }
}

// ==================== Crypto Service Output Adapter ====================

/// AES-256-CBC 加密服务适配器（OutputAdapter）
pub struct AesCryptoOutputAdapter {
    key: [u8; 32],
}

impl AesCryptoOutputAdapter {
    pub fn from_env() -> Result<Self, CryptoError> {
        let key_str = std::env::var("API_KEY_ENCRYPTION_KEY")
            .map_err(|_| CryptoError::InvalidKeyLength)?;

        let key_bytes = base64::decode(&key_str)
            .map_err(|_| CryptoError::InvalidKeyLength)?;

        if key_bytes.len() != 32 {
            return Err(CryptoError::InvalidKeyLength);
        }

        let mut key = [0u8; 32];
        key.copy_from_slice(&key_bytes);
        Ok(Self { key })
    }
}

impl CryptoServiceOutputPort for AesCryptoOutputAdapter {
    fn encrypt(&self, plaintext: &str) -> Result<String, CryptoError> {
        use aes::Aes256;
        use cbc::{Encryptor, cipher::{BlockEncryptMut, KeyIvInit}};
        use rand::Rng;

        let mut rng = rand::thread_rng();
        let mut iv = [0u8; 16];
        rng.fill(&mut iv);

        let cipher = Encryptor::<Aes256>::new(&self.key.into(), &iv.into());
        let mut buf = vec![0u8; (plaintext.len() + 15) & !15];
        buf[..plaintext.len()].copy_from_slice(plaintext.as_bytes());

        cipher.encrypt_padded_blocks_mut::<aes::cipher::block_padding::Pkcs7>(&mut buf)
            .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

        let mut combined = iv.to_vec();
        combined.extend(buf);
        Ok(base64::encode(&combined))
    }

    fn decrypt(&self, ciphertext: &str) -> Result<String, CryptoError> {
        use aes::Aes256;
        use cbc::{Decryptor, cipher::{BlockDecryptMut, KeyIvInit}};

        let combined = base64::decode(ciphertext)
            .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))?;

        if combined.len() < 16 {
            return Err(CryptoError::DecryptionFailed("Data too short".into()));
        }

        let (iv, encrypted) = combined.split_at(16);
        let mut iv_arr = [0u8; 16];
        iv_arr.copy_from_slice(iv);

        let mut buf = encrypted.to_vec();
        let cipher = Decryptor::<Aes256>::new(&self.key.into(), &iv_arr.into());

        cipher.decrypt_padded_blocks_mut::<aes::cipher::block_padding::Pkcs7>(&mut buf)
            .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))?;

        String::from_utf8(buf)
            .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))
    }

    async fn verify(&self, apikey: &ApiKey) -> Result<bool, VerifyError> {
        use reqwest::Client;
        use std::time::Duration;

        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|e| VerifyError::NetworkError(e.to_string()))?;

        let api_key = self.decrypt(&apikey.encrypted_key)
            .map_err(|e| VerifyError::NetworkError(format!("decrypt failed: {}", e)))?;

        let base_url = apikey.base_url.as_deref()
            .unwrap_or("https://api.openai.com");

        let response = client
            .get(format!("{}/v1/models", base_url))
            .header("Authorization", format!("Bearer {}", api_key))
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

### 5.2 InputAdapter（ApikeyInputAdapter.rs）

实现 Tauri Commands，作为 driving adapter 调用 InputPort。

```rust
// src-tauri/src/infra/apikey/ApikeyInputAdapter.rs

use tauri;
use std::sync::Arc;

use crate::application::apikey::ApikeyApplication;
use crate::domain::apikey::{
    ApiKeyId, KeyStatus, LlmProvider,
    ApikeyInputPort, ApikeyInputError,
};
use crate::domain::apikey::ApikeyEntity::ApiKey;

/// DTO: API Key 响应（对外不暴露 encrypted_key）
#[derive(serde::Serialize)]
pub struct ApikeyResponseDto {
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

impl From<&ApiKey> for ApikeyResponseDto {
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

/// 将 InputPort 错误映射为 Tauri 友好的字符串
fn map_err(e: ApikeyInputError) -> String {
    e.to_string()
}

/// 创建 API Key
#[tauri::command]
pub async fn apikey_create(
    app: tauri::AppHandle,
    name: String,
    api_key: String,
    provider: String,
    model: String,
    base_url: Option<String>,
) -> Result<ApikeyResponseDto, String> {
    let application = app.state::<Arc<dyn ApikeyInputPort>>();
    let prov = serde_json::from_str::<LlmProvider>(&format!("\"{}\"", provider))
        .map_err(|e| format!("Invalid provider: {}", e))?;

    application
        .create(name, api_key, prov, model, base_url)
        .await
        .map(ApikeyResponseDto::from)
        .map_err(map_err)
}

/// 获取 API Key 列表
#[tauri::command]
pub async fn apikey_list(
    app: tauri::AppHandle,
) -> Result<Vec<ApikeyResponseDto>, String> {
    let application = app.state::<Arc<dyn ApikeyInputPort>>();
    application
        .list_all()
        .await
        .map(|keys| keys.iter().map(ApikeyResponseDto::from).collect())
        .map_err(map_err)
}

/// 获取单个 API Key
#[tauri::command]
pub async fn apikey_get(
    app: tauri::AppHandle,
    id: String,
) -> Result<Option<ApikeyResponseDto>, String> {
    let application = app.state::<Arc<dyn ApikeyInputPort>>();
    application
        .get_by_id(&id)
        .await
        .map(|opt| opt.map(ApikeyResponseDto::from))
        .map_err(map_err)
}

/// 更新 API Key
#[tauri::command]
pub async fn apikey_update(
    app: tauri::AppHandle,
    id: String,
    name: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    status: Option<String>,
) -> Result<ApikeyResponseDto, String> {
    let application = app.state::<Arc<dyn ApikeyInputPort>>();
    let key_status = if let Some(s) = status {
        Some(serde_json::from_str(&format!("\"{}\"", s))
            .map_err(|e| format!("Invalid status: {}", e))?)
    } else {
        None
    };

    application
        .update(&id, name, api_key, model, base_url, key_status)
        .await
        .map(ApikeyResponseDto::from)
        .map_err(map_err)
}

/// 删除 API Key
#[tauri::command]
pub async fn apikey_delete(
    app: tauri::AppHandle,
    id: String,
) -> Result<(), String> {
    let application = app.state::<Arc<dyn ApikeyInputPort>>();
    application.delete(&id).await.map_err(map_err)
}

/// 验证 API Key
#[tauri::command]
pub async fn apikey_verify(
    app: tauri::AppHandle,
    id: String,
) -> Result<bool, String> {
    let application = app.state::<Arc<dyn ApikeyInputPort>>();
    application.verify(&id).await.map_err(map_err)
}
```

### 5.3 mod.rs（infra/apikey）

```rust
// src-tauri/src/infra/apikey/mod.rs

pub mod ApikeyInputAdapter;
pub mod ApikeyOutputAdapter;

pub use ApikeyInputAdapter::*;
pub use ApikeyOutputAdapter::*;
```

## 6. 组件装配（lib.rs）

```rust
// src-tauri/src/lib.rs

mod domain;
mod application;
mod infra;

use std::sync::Arc;
use rusqlite::Connection;
use tauri::Manager;

use application::apikey::ApikeyApplication;
use domain::apikey::{
    ApikeyInputPort,
    ApikeyRepositoryOutputPort,
    CryptoServiceOutputPort,
};
use infra::apikey::{
    SqliteApikeyRepositoryOutputAdapter,
    AesCryptoOutputAdapter,
    apikey_create, apikey_list, apikey_get, apikey_update, apikey_delete, apikey_verify,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // 1. 创建 SQLite 连接
            let app_data_dir = app.path().app_data_dir().unwrap();
            std::fs::create_dir_all(&app_data_dir).unwrap();
            let db_path = app_data_dir.join("easy_agent.db");
            let conn = Arc::new(Connection::open(&db_path).unwrap());

            // 2. 初始化表
            let repo_adapter = SqliteApikeyRepositoryOutputAdapter::new(conn.clone());
            repo_adapter.init_table().unwrap();

            // 3. 创建 OutputAdapter（实现 OutputPort）
            let crypto_adapter = Arc::new(
                AesCryptoOutputAdapter::from_env()
                    .expect("Missing API_KEY_ENCRYPTION_KEY")
            );
            let repo_adapter = Arc::new(repo_adapter);

            // 4. 创建 Application（实现 InputPort）
            let application = Arc::new(ApikeyApplication::new(
                repo_adapter.clone() as Arc<dyn ApikeyRepositoryOutputPort>,
                crypto_adapter.clone() as Arc<dyn CryptoServiceOutputPort>,
            ));

            // 5. 注册到 Tauri state（InputPort 接口）
            app.manage(application as Arc<dyn ApikeyInputPort>);

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            apikey_create,
            apikey_list,
            apikey_get,
            apikey_update,
            apikey_delete,
            apikey_verify,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## 7. 六边形架构全貌

```
┌─────────────────────────────────────────────────────────────┐
│              Infra（基础设施层）                              │
│  ┌─────────────────────┐       ┌─────────────────────────┐  │
│  │  ApikeyInputAdapter │       │  ApikeyOutputAdapter    │  │
│  │  (实现 InputPort)   │       │  (实现 OutputPort)      │  │
│  │  Tauri Commands     │       │  Sqlite + AES + HTTP    │  │
│  └──────────┬──────────┘       └───────────┬─────────────┘  │
└─────────────┼─────────────────────────────┼─────────────────┘
              │                             │
              ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Application（应用层）                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            ApikeyApplication                          │  │
│  │  实现 InputPort  │  编排 OutputPort（依赖倒置注入）      │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Domain（领域层）                                 │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │ ApikeyEntity │  │ ApikeyInputPort│  │ApikeyOutputPort│  │
│  │  （实体）     │  │（接口，外部调用）│  │（接口，外部依赖）│  │
│  └──────────────┘  └───────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 依赖方向

- **ApikeyApplication** 实现 **ApikeyInputPort**（被 InputAdapter 调用）
- **ApikeyApplication** 依赖 **ApikeyOutputPort**（由 OutputAdapter 注入）
- **ApikeyEntity** 纯净无外部依赖
- **ApikeyInputAdapter** 调用 **ApikeyInputPort**（Tauri → 核心）
- **ApikeyOutputAdapter** 实现 **ApikeyOutputPort**（外部 → 核心）
