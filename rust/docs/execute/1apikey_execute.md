# API Key 模块 — 六边形架构实现文档

> 参考旧工程 `electron1/electron`，按照 Domain → Application → Infrastructure → Services 四层架构，翻译为 Rust/Tauri 版本。

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Web UI)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │  Tauri invoke() / commands
┌──────────────────────────▼──────────────────────────────────────┐
│                     Services 层 (services/)                       │
│   · 依赖注入：将 infrastructure 实现注入 application              │
│   · 统一管理所有服务                                             │
│   · 暴露给外部（API/UI）调用的入口                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │  trait ApiKeyServicePort
┌──────────────────────────▼──────────────────────────────────────┐
│                  Application 层 (application/)                    │
│   · 实现 domain 中的"业务 trait"                                │
│   · 编排多个 Repository 操作                                     │
│   · 业务逻辑、规则验证                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │  trait ApiKeyRepository (持久化接口)
┌──────────────────────────▼──────────────────────────────────────┐
│                   Domain 层 (domain/)                             │
│   · 定义 struct（实体）                                         │
│   · 定义 trait（接口）                                           │
│     - 业务 trait（实体方法）                                     │
│     - 持久化 trait（Repository 接口）                           │
│   · 纯业务，无任何实现                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │  实现
┌──────────────────────────▼──────────────────────────────────────┐
│                Infrastructure 层 (infra/)                        │
│   · 实现 domain 中的"持久化 trait"（Repository impl）           │
│   · 处理 SQL、文件、网络等具体技术                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、目录结构

```
src-tauri/src/
├── main.rs                          # 入口，调用 lib::run()
├── lib.rs                           # 组装层，注册 plugin/command/state
│
├── domain/                          # ============ Domain 层 ============
│   ├── mod.rs
│   └── api_key/
│       ├── mod.rs                  # 模块导出
│       ├── entity.rs               # 实体：ApiKey、ApiKeyId、枚举
│       ├── repository.rs            # 持久化 trait：ApiKeyRepository
│       └── service_trait.rs         # 业务 trait：ApiKeyServiceTrait
│
├── application/                    # ============ Application 层 ============
│   ├── mod.rs
│   └── api_key/
│       ├── mod.rs
│       ├── dto.rs                  # DTO 数据传输对象
│       └── service.rs              # 实现业务 trait
│
├── infra/                          # ============ Infrastructure 层 ============
│   ├── mod.rs
│   └── storage/
│       ├── mod.rs                  # StoragePort trait 定义
│       └── sqlite/
│           ├── mod.rs
│           └── api_key_adapter.rs  # ApiKeyRepository SQLite 实现
│
└── services/                       # ============ Services 层 ============
    ├── mod.rs
    └── api_key/
        ├── mod.rs
        └── service.rs              # 依赖注入，组装层入口
```

---

## 三、Domain 层（纯业务定义，无实现）

### 3.1 实体（Entity）

> 参考：`electron1/electron/core/domain/entities/ApiKey.ts`

```rust
// src-tauri/src/domain/api_key/entity.rs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ==================== 包装类型 ====================

/// API Key 唯一标识符（值对象）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ApiKeyId(pub String);

impl ApiKeyId {
    /// 使用 UUID 生成新的 ID
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

// ==================== 枚举定义 ====================

/// LLM 提供商枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LlmProvider {
    OpenAi,
    Anthropic,
    #[serde(rename = "qwen")]
    Qwen,
    #[serde(rename = "groq")]
    Groq,
    #[serde(rename = "deepseek")]
    DeepSeek,
    #[serde(rename = "gemini")]
    Gemini,
    #[serde(rename = "xiaomi")]
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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKey {
    /// 唯一标识符
    pub id: ApiKeyId,
    /// 名称（用户自定义）
    pub name: String,
    /// 加密后的 Key（存储时不暴露明文）
    pub encrypted_key: String,
    /// LLM 提供商
    pub provider: LlmProvider,
    /// 模型名称（如 gpt-4o、claude-sonnet-4-20250514）
    pub model: String,
    /// 可选的自定义 API 地址（如 OpenAI 代理）
    pub base_url: Option<String>,
    /// 启用/禁用状态
    pub status: KeyStatus,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
    /// 最后使用时间
    pub last_used_at: Option<DateTime<Utc>>,
}

impl ApiKey {
    // ============ 构造函数 ============

    /// 创建新的 API Key 实体
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

    // ============ 静态工厂方法 ============

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

    /// 是否处于激活状态
    pub fn is_active(&self) -> bool {
        self.status == KeyStatus::Active
    }

    /// 激活该 Key
    pub fn activate(&mut self) {
        self.status = KeyStatus::Active;
        self.updated_at = Utc::now();
    }

    /// 停用该 Key
    pub fn deactivate(&mut self) {
        self.status = KeyStatus::Inactive;
        self.updated_at = Utc::now();
    }

    /// 标记为已过期
    pub fn mark_expired(&mut self) {
        self.status = KeyStatus::Expired;
        self.updated_at = Utc::now();
    }

    /// 记录使用时间
    pub fn record_usage(&mut self) {
        self.last_used_at = Some(Utc::now());
        self.updated_at = Utc::now();
    }

    /// 设置自定义 Base URL
    pub fn set_base_url(&mut self, url: Option<String>) {
        self.base_url = url;
        self.updated_at = Utc::now();
    }

    /// 更新模型名称
    pub fn update_model(&mut self, model: String) {
        self.model = model;
        self.updated_at = Utc::now();
    }

    /// 更新 Key（加密后的）
    pub fn update_key(&mut self, encrypted_key: String) {
        self.encrypted_key = encrypted_key;
        self.updated_at = Utc::now();
    }
}
```

### 3.2 持久化 Repository Trait

> 参考：`electron1/electron/core/ports/persistence/ApiKeyRepository.ts`

```rust
// src-tauri/src/domain/api_key/repository.rs

use super::entity::{ApiKey, ApiKeyId};

/// API Key 持久化 Repository 接口（依赖倒置原则）
///
/// domain 层定义接口，infra 层实现具体技术（SQLite）。
pub trait ApiKeyRepository: Send + Sync {
    /// 保存（新建或更新）API Key
    fn save(&self, api_key: &ApiKey) -> Result<(), RepositoryError>;

    /// 根据 ID 查询
    fn find_by_id(&self, id: &ApiKeyId) -> Result<Option<ApiKey>, RepositoryError>;

    /// 查询所有 API Key
    fn find_all(&self) -> Result<Vec<ApiKey>, RepositoryError>;

    /// 查询所有启用的 API Key
    fn find_enabled(&self) -> Result<Vec<ApiKey>, RepositoryError>;

    /// 根据提供商查询
    fn find_by_provider(&self, provider: &str) -> Result<Vec<ApiKey>, RepositoryError>;

    /// 删除指定 ID 的 API Key
    fn delete(&self, id: &ApiKeyId) -> Result<bool, RepositoryError>;

    /// 获取加密后的 Key（供解密使用）
    fn get_encrypted_key(&self, id: &ApiKeyId) -> Result<Option<String>, RepositoryError>;
}

/// Repository 层错误类型
#[derive(Debug, Clone)]
pub enum RepositoryError {
    NotFound,
    ConnectionFailed(String),
    QueryFailed(String),
    SerializationFailed(String),
}

impl std::fmt::Display for RepositoryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RepositoryError::NotFound => write!(f, "API Key not found"),
            RepositoryError::ConnectionFailed(msg) => write!(f, "Connection failed: {}", msg),
            RepositoryError::QueryFailed(msg) => write!(f, "Query failed: {}", msg),
            RepositoryError::SerializationFailed(msg) => write!(f, "Serialization failed: {}", msg),
        }
    }
}

impl std::error::Error for RepositoryError {}
```

### 3.3 业务 Service Trait

```rust
// src-tauri/src/domain/api_key/service_trait.rs

use super::entity::{ApiKey, ApiKeyId, LlmProvider};

/// API Key 业务服务接口
///
/// 定义业务操作，不涉及持久化细节。
pub trait ApiKeyServiceTrait: Send + Sync {
    /// 创建新的 API Key
    ///
    /// 会自动加密明文 Key 并存储。
    fn create_api_key(
        &self,
        name: String,
        raw_key: String,
        provider: LlmProvider,
        model: String,
        base_url: Option<String>,
    ) -> Result<ApiKey, ServiceError>;

    /// 获取指定 ID 的 API Key（含解密后的明文 Key）
    fn get_api_key(&self, id: &ApiKeyId) -> Result<Option<ApiKey>, ServiceError>;

    /// 获取解密后的明文 Key
    fn get_decrypted_key(&self, id: &ApiKeyId) -> Result<Option<String>, ServiceError>;

    /// 列出所有 API Key（不包含明文 Key）
    fn list_api_keys(&self) -> Result<Vec<ApiKey>, ServiceError>;

    /// 列出所有启用的 API Key
    fn list_enabled_api_keys(&self) -> Result<Vec<ApiKey>, ServiceError>;

    /// 列出指定提供商的 API Key
    fn list_api_keys_by_provider(&self, provider: &str) -> Result<Vec<ApiKey>, ServiceError>;

    /// 更新 API Key 的明文 Key（会重新加密）
    fn update_key(&self, id: &ApiKeyId, raw_key: String) -> Result<bool, ServiceError>;

    /// 更新 API Key 的元信息（模型、base_url 等）
    fn update_meta(
        &self,
        id: &ApiKeyId,
        name: Option<String>,
        model: Option<String>,
        base_url: Option<String>,
    ) -> Result<bool, ServiceError>;

    /// 启用/禁用 API Key
    fn set_enabled(&self, id: &ApiKeyId, enabled: bool) -> Result<bool, ServiceError>;

    /// 删除 API Key
    fn delete_api_key(&self, id: &ApiKeyId) -> Result<bool, ServiceError>;

    /// 获取激活的 API Key（按规则选择一个可用的）
    fn get_active_api_key(&self) -> Result<Option<ApiKey>, ServiceError>;
}

/// Service 层错误类型
#[derive(Debug, Clone)]
pub enum ServiceError {
    NotFound,
    EncryptionFailed(String),
    DecryptionFailed(String),
    RepositoryError(String),
    ValidationError(String),
}

impl std::fmt::Display for ServiceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ServiceError::NotFound => write!(f, "API Key not found"),
            ServiceError::EncryptionFailed(msg) => write!(f, "Encryption failed: {}", msg),
            ServiceError::DecryptionFailed(msg) => write!(f, "Decryption failed: {}", msg),
            ServiceError::RepositoryError(msg) => write!(f, "Repository error: {}", msg),
            ServiceError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
        }
    }
}

impl std::error::Error for ServiceError {}
```

### 3.4 Domain 模块导出

```rust
// src-tauri/src/domain/api_key/mod.rs

pub mod entity;
pub mod repository;
pub mod service_trait;

pub use entity::*;
pub use repository::*;
pub use service_trait::*;
```

```rust
// src-tauri/src/domain/mod.rs

pub mod api_key;
```

---

## 四、Application 层（业务逻辑实现）

### 4.1 DTO（数据传输对象）

> 参考：`electron1/electron/core/ports/storage.port.ts` 中的 `CreateApiKeyDTO`

```rust
// src-tauri/src/application/api_key/dto.rs

use serde::{Deserialize, Serialize};

use crate::domain::api_key::{ApiKey, LlmProvider};

/// 创建 API Key 的请求 DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApiKeyDto {
    /// 名称
    pub name: String,
    /// 明文 API Key
    pub key: String,
    /// 提供商
    pub provider: LlmProvider,
    /// 模型
    pub model: String,
    /// 可选的自定义 Base URL
    #[serde(default)]
    pub base_url: Option<String>,
}

/// 更新 API Key 密钥的请求 DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateApiKeyDto {
    /// 新的明文 Key
    pub key: String,
}

/// 更新 API Key 元信息的请求 DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateApiKeyMetaDto {
    /// 新名称
    #[serde(default)]
    pub name: Option<String>,
    /// 新模型
    #[serde(default)]
    pub model: Option<String>,
    /// 新 Base URL
    #[serde(default)]
    pub base_url: Option<String>,
}

/// API Key 响应 DTO（对外暴露，不含敏感信息）
#[derive(Debug, Clone, Serialize, Deserialize)]
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
    fn from(api_key: &ApiKey) -> Self {
        Self {
            id: api_key.id.0.clone(),
            name: api_key.name.clone(),
            provider: api_key.provider.as_str().to_string(),
            model: api_key.model.clone(),
            base_url: api_key.base_url.clone(),
            status: format!("{:?}", api_key.status),
            is_active: api_key.is_active(),
            created_at: api_key.created_at.to_rfc3339(),
            updated_at: api_key.updated_at.to_rfc3339(),
            last_used_at: api_key.last_used_at.map(|dt| dt.to_rfc3339()),
        }
    }
}

/// 创建结果 DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApiKeyResultDto {
    pub api_key: ApiKeyResponseDto,
    pub decrypted_key: String,
}
```

### 4.2 业务 Service 实现

> 参考：`electron1/electron/core/application/LLMManager.ts` 和 `electron1/electron/core/index.ts`

```rust
// src-tauri/src/application/api_key/service.rs

use crate::domain::api_key::{
    ApiKey, ApiKeyId, ApiKeyRepository, ApiKeyServiceTrait, KeyStatus, LlmProvider,
    RepositoryError, ServiceError,
};
use std::sync::Arc;

/// API Key 业务服务实现
///
/// 编排 Repository 操作 + 加解密 + 业务规则验证。
pub struct ApiKeyService<R: ApiKeyRepository, E: Encryptor> {
    repository: Arc<R>,
    encryptor: Arc<E>,
}

impl<R: ApiKeyRepository, E: Encryptor> ApiKeyService<R, E> {
    pub fn new(repository: Arc<R>, encryptor: Arc<E>) -> Self {
        Self { repository, encryptor }
    }
}

impl<R: ApiKeyRepository + 'static, E: Encryptor + 'static> ApiKeyServiceTrait
    for ApiKeyService<R, E>
{
    fn create_api_key(
        &self,
        name: String,
        raw_key: String,
        provider: LlmProvider,
        model: String,
        base_url: Option<String>,
    ) -> Result<ApiKey, ServiceError> {
        // ============ 业务规则验证 ============
        if name.trim().is_empty() {
            return Err(ServiceError::ValidationError("Name cannot be empty".to_string()));
        }
        if raw_key.trim().is_empty() {
            return Err(ServiceError::ValidationError("Key cannot be empty".to_string()));
        }
        if model.trim().is_empty() {
            return Err(ServiceError::ValidationError("Model cannot be empty".to_string()));
        }

        // ============ 加密 Key ============
        let encrypted_key = self
            .encryptor
            .encrypt(&raw_key)
            .map_err(|e| ServiceError::EncryptionFailed(e.to_string()))?;

        // ============ 构建实体 ============
        let api_key = ApiKey::new(name, encrypted_key, provider, model);
        let api_key = match base_url {
            Some(url) => {
                let mut k = api_key;
                k.set_base_url(Some(url));
                k
            }
            None => api_key,
        };

        // ============ 持久化 ============
        self.repository
            .save(&api_key)
            .map_err(|e| ServiceError::RepositoryError(e.to_string()))?;

        Ok(api_key)
    }

    fn get_api_key(&self, id: &ApiKeyId) -> Result<Option<ApiKey>, ServiceError> {
        self.repository
            .find_by_id(id)
            .map_err(|e| ServiceError::RepositoryError(e.to_string()))
    }

    fn get_decrypted_key(&self, id: &ApiKeyId) -> Result<Option<String>, ServiceError> {
        let encrypted_opt = self
            .repository
            .get_encrypted_key(id)
            .map_err(|e| ServiceError::RepositoryError(e.to_string()))?;

        match encrypted_opt {
            Some(encrypted) => {
                let decrypted = self
                    .encryptor
                    .decrypt(&encrypted)
                    .map_err(|e| ServiceError::DecryptionFailed(e.to_string()))?;
                Ok(Some(decrypted))
            }
            None => Ok(None),
        }
    }

    fn list_api_keys(&self) -> Result<Vec<ApiKey>, ServiceError> {
        self.repository
            .find_all()
            .map_err(|e| ServiceError::RepositoryError(e.to_string()))
    }

    fn list_enabled_api_keys(&self) -> Result<Vec<ApiKey>, ServiceError> {
        self.repository
            .find_enabled()
            .map_err(|e| ServiceError::RepositoryError(e.to_string()))
    }

    fn list_api_keys_by_provider(&self, provider: &str) -> Result<Vec<ApiKey>, ServiceError> {
        self.repository
            .find_by_provider(provider)
            .map_err(|e| ServiceError::RepositoryError(e.to_string()))
    }

    fn update_key(&self, id: &ApiKeyId, raw_key: String) -> Result<bool, ServiceError> {
        if raw_key.trim().is_empty() {
            return Err(ServiceError::ValidationError("Key cannot be empty".to_string()));
        }

        let mut api_key_opt = self
            .repository
            .find_by_id(id)
            .map_err(|e| ServiceError::RepositoryError(e.to_string()))?;

        match api_key_opt.as_mut() {
            Some(api_key) => {
                let encrypted = self
                    .encryptor
                    .encrypt(&raw_key)
                    .map_err(|e| ServiceError::EncryptionFailed(e.to_string()))?;
                api_key.update_key(encrypted);
                self.repository
                    .save(api_key)
                    .map_err(|e| ServiceError::RepositoryError(e.to_string()))?;
                Ok(true)
            }
            None => Err(ServiceError::NotFound),
        }
    }

    fn update_meta(
        &self,
        id: &ApiKeyId,
        name: Option<String>,
        model: Option<String>,
        base_url: Option<String>,
    ) -> Result<bool, ServiceError> {
        let mut api_key_opt = self
            .repository
            .find_by_id(id)
            .map_err(|e| ServiceError::RepositoryError(e.to_string()))?;

        match api_key_opt.as_mut() {
            Some(api_key) => {
                if let Some(n) = name {
                    if !n.trim().is_empty() {
                        api_key.name = n;
                        api_key.updated_at = chrono::Utc::now();
                    }
                }
                if let Some(m) = model {
                    if !m.trim().is_empty() {
                        api_key.update_model(m);
                    }
                }
                api_key.set_base_url(base_url);
                self.repository
                    .save(api_key)
                    .map_err(|e| ServiceError::RepositoryError(e.to_string()))?;
                Ok(true)
            }
            None => Err(ServiceError::NotFound),
        }
    }

    fn set_enabled(&self, id: &ApiKeyId, enabled: bool) -> Result<bool, ServiceError> {
        let mut api_key_opt = self
            .repository
            .find_by_id(id)
            .map_err(|e| ServiceError::RepositoryError(e.to_string()))?;

        match api_key_opt.as_mut() {
            Some(api_key) => {
                if enabled {
                    api_key.activate();
                } else {
                    api_key.deactivate();
                }
                self.repository
                    .save(api_key)
                    .map_err(|e| ServiceError::RepositoryError(e.to_string()))?;
                Ok(true)
            }
            None => Err(ServiceError::NotFound),
        }
    }

    fn delete_api_key(&self, id: &ApiKeyId) -> Result<bool, ServiceError> {
        self.repository
            .delete(id)
            .map_err(|e| ServiceError::RepositoryError(e.to_string()))
    }

    fn get_active_api_key(&self) -> Result<Option<ApiKey>, ServiceError> {
        let enabled_keys = self
            .repository
            .find_enabled()
            .map_err(|e| ServiceError::RepositoryError(e.to_string()))?;

        // 策略：优先使用最近使用的，其次按创建时间
        let active = enabled_keys
            .iter()
            .max_by_key(|k| k.last_used_at.unwrap_or(k.created_at));
        Ok(active.cloned())
    }
}

/// 加解密接口
pub trait Encryptor: Send + Sync {
    fn encrypt(&self, plaintext: &str) -> Result<String, String>;
    fn decrypt(&self, ciphertext: &str) -> Result<String, String>;
}
```

### 4.3 Application 模块导出

```rust
// src-tauri/src/application/api_key/mod.rs

pub mod dto;
pub mod service;

pub use dto::*;
pub use service::*;
```

```rust
// src-tauri/src/application/mod.rs

pub mod api_key;
```

---

## 五、Infrastructure 层（持久化实现）

### 5.1 SQLite StoragePort Trait

> 参考：`electron1/electron/core/adapters/storage/sqlite.adapter.ts` 中的 `IStoragePort` 接口

```rust
// src-tauri/src/infra/storage/mod.rs

/// Storage 错误类型
#[derive(Debug, Clone)]
pub enum StorageError {
    ConnectionFailed(String),
    QueryFailed(String),
    NotFound,
    MigrationFailed(String),
}

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StorageError::ConnectionFailed(msg) => write!(f, "Connection failed: {}", msg),
            StorageError::QueryFailed(msg) => write!(f, "Query failed: {}", msg),
            StorageError::NotFound => write!(f, "Resource not found"),
            StorageError::MigrationFailed(msg) => write!(f, "Migration failed: {}", msg),
        }
    }
}

impl std::error::Error for StorageError {}

/// Storage 端口（依赖倒置）
///
/// domain 层定义此接口，infra 层实现。
pub trait StoragePort: Send + Sync {
    /// 初始化数据库（建表、迁移等）
    fn init(&self) -> Result<(), StorageError>;

    /// 获取数据库路径
    fn db_path(&self) -> &str;
}
```

### 5.2 SQLite ApiKey Adapter

> 参考：`electron1/electron/core/adapters/persistence/SQLiteApiKeyAdapter.ts`

```rust
// src-tauri/src/infra/storage/sqlite/api_key_adapter.rs

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use std::sync::Mutex;

use crate::domain::api_key::{
    ApiKey, ApiKeyId, ApiKeyRepository, KeyStatus, LlmProvider, RepositoryError,
};

/// SQLite 实现的 ApiKey Repository
pub struct SqliteApiKeyAdapter {
    conn: Mutex<Connection>,
}

impl SqliteApiKeyAdapter {
    pub fn new(db_path: &str) -> Result<Self, RepositoryError> {
        let conn = Connection::open(db_path)
            .map_err(|e| RepositoryError::ConnectionFailed(e.to_string()))?;

        // 启用外键约束
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|e| RepositoryError::QueryFailed(e.to_string()))?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// 初始化表结构
    pub fn init_schema(&self) -> Result<(), RepositoryError> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                encrypted_key TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                base_url TEXT,
                status TEXT NOT NULL DEFAULT 'Active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_used_at TEXT
            );
            "#,
        )
        .map_err(|e| RepositoryError::QueryFailed(e.to_string()))?;
        Ok(())
    }

    fn row_to_entity(row: &rusqlite::Row) -> Result<ApiKey, rusqlite::Error> {
        let id_str: String = row.get(0)?;
        let provider_str: String = row.get(3)?;
        let status_str: String = row.get(6)?;
        let created_str: String = row.get(7)?;
        let updated_str: String = row.get(8)?;
        let last_used_opt: Option<String> = row.get(9)?;

        let provider = match provider_str.as_str() {
            "OpenAi" | "openai" => LlmProvider::OpenAi,
            "Anthropic" | "anthropic" => LlmProvider::Anthropic,
            "qwen" => LlmProvider::Qwen,
            "groq" => LlmProvider::Groq,
            "deepseek" => LlmProvider::DeepSeek,
            "gemini" => LlmProvider::Gemini,
            "xiaomi" => LlmProvider::Xiaomi,
            _ => LlmProvider::OpenAi,
        };

        let status = match status_str.as_str() {
            "Active" => KeyStatus::Active,
            "Inactive" => KeyStatus::Inactive,
            "Expired" => KeyStatus::Expired,
            _ => KeyStatus::Active,
        };

        let created_at = DateTime::parse_from_rfc3339(&created_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        let updated_at = DateTime::parse_from_rfc3339(&updated_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        let last_used_at = last_used_opt.and_then(|s| {
            DateTime::parse_from_rfc3339(&s)
                .map(|dt| dt.with_timezone(&Utc))
                .ok()
        });

        Ok(ApiKey::reconstitute(
            ApiKeyId::from_string(id_str),
            row.get(1)?,
            row.get(2)?,
            provider,
            row.get(4)?,
            row.get(5)?,
            status,
            created_at,
            updated_at,
            last_used_at,
        ))
    }
}

impl ApiKeyRepository for SqliteApiKeyAdapter {
    fn save(&self, api_key: &ApiKey) -> Result<(), RepositoryError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            r#"INSERT OR REPLACE INTO api_keys
               (id, name, encrypted_key, provider, model, base_url, status, created_at, updated_at, last_used_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"#,
            params![
                api_key.id.0,
                api_key.name,
                api_key.encrypted_key,
                serde_json::to_string(&api_key.provider)
                    .map_err(|e| RepositoryError::SerializationFailed(e.to_string()))?,
                api_key.model,
                api_key.base_url,
                serde_json::to_string(&api_key.status)
                    .map_err(|e| RepositoryError::SerializationFailed(e.to_string()))?,
                api_key.created_at.to_rfc3339(),
                api_key.updated_at.to_rfc3339(),
                api_key.last_used_at.map(|dt| dt.to_rfc3339()),
            ],
        )
        .map_err(|e| RepositoryError::QueryFailed(e.to_string()))?;
        Ok(())
    }

    fn find_by_id(&self, id: &ApiKeyId) -> Result<Option<ApiKey>, RepositoryError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                r#"SELECT id, name, encrypted_key, provider, model, base_url, status, created_at, updated_at, last_used_at
                   FROM api_keys WHERE id = ?1"#,
            )
            .map_err(|e| RepositoryError::QueryFailed(e.to_string()))?;

        let result = stmt.query_row(params![id.0], Self::row_to_entity);

        match result {
            Ok(api_key) => Ok(Some(api_key)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(RepositoryError::QueryFailed(e.to_string())),
        }
    }

    fn find_all(&self) -> Result<Vec<ApiKey>, RepositoryError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                r#"SELECT id, name, encrypted_key, provider, model, base_url, status, created_at, updated_at, last_used_at
                   FROM api_keys ORDER BY created_at DESC"#,
            )
            .map_err(|e| RepositoryError::QueryFailed(e.to_string()))?;

        let rows = stmt
            .query_map([], Self::row_to_entity)
            .map_err(|e| RepositoryError::QueryFailed(e.to_string()))?;

        let mut api_keys = Vec::new();
        for row in rows {
            api_keys.push(row.map_err(|e| RepositoryError::QueryFailed(e.to_string()))?);
        }
        Ok(api_keys)
    }

    fn find_enabled(&self) -> Result<Vec<ApiKey>, RepositoryError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                r#"SELECT id, name, encrypted_key, provider, model, base_url, status, created_at, updated_at, last_used_at
                   FROM api_keys WHERE status = 'Active' ORDER BY created_at DESC"#,
            )
            .map_err(|e| RepositoryError::QueryFailed(e.to_string()))?;

        let rows = stmt
            .query_map([], Self::row_to_entity)
            .map_err(|e| RepositoryError::QueryFailed(e.to_string()))?;

        let mut api_keys = Vec::new();
        for row in rows {
            api_keys.push(row.map_err(|e| RepositoryError::QueryFailed(e.to_string()))?);
        }
        Ok(api_keys)
    }

    fn find_by_provider(&self, provider: &str) -> Result<Vec<ApiKey>, RepositoryError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                r#"SELECT id, name, encrypted_key, provider, model, base_url, status, created_at, updated_at, last_used_at
                   FROM api_keys WHERE provider = ?1 ORDER BY created_at DESC"#,
            )
            .map_err(|e| RepositoryError::QueryFailed(e.to_string()))?;

        let rows = stmt
            .query_map(params![provider], Self::row_to_entity)
            .map_err(|e| RepositoryError::QueryFailed(e.to_string()))?;

        let mut api_keys = Vec::new();
        for row in rows {
            api_keys.push(row.map_err(|e| RepositoryError::QueryFailed(e.to_string()))?);
        }
        Ok(api_keys)
    }

    fn delete(&self, id: &ApiKeyId) -> Result<bool, RepositoryError> {
        let conn = self.conn.lock().unwrap();
        let affected = conn
            .execute("DELETE FROM api_keys WHERE id = ?1", params![id.0])
            .map_err(|e| RepositoryError::QueryFailed(e.to_string()))?;
        Ok(affected > 0)
    }

    fn get_encrypted_key(&self, id: &ApiKeyId) -> Result<Option<String>, RepositoryError> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT encrypted_key FROM api_keys WHERE id = ?1",
            params![id.0],
            |row| row.get(0),
        );

        match result {
            Ok(key) => Ok(Some(key)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(RepositoryError::QueryFailed(e.to_string())),
        }
    }
}
```

### 5.3 SQLite Storage 主适配器

> 参考：`electron1/electron/core/adapters/storage/sqlite.adapter.ts`

```rust
// src-tauri/src/infra/storage/sqlite/mod.rs

mod api_key_adapter;

pub use api_key_adapter::SqliteApiKeyAdapter;

use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use super::mod::{StorageError, StoragePort};

/// SQLite 存储主适配器
pub struct SqliteStorageAdapter {
    db_path: String,
    conn: Mutex<Connection>,
}

impl SqliteStorageAdapter {
    pub fn new<P: AsRef<Path>>(db_path: P) -> Result<Self, StorageError> {
        let db_path_str = db_path
            .as_ref()
            .to_str()
            .ok_or_else(|| StorageError::ConnectionFailed("Invalid path".to_string()))?
            .to_string();

        let conn = Connection::open(&db_path_str)
            .map_err(|e| StorageError::ConnectionFailed(e.to_string()))?;

        // 配置 SQLite
        conn.execute_batch("PRAGMA journal_mode = WAL;")
            .map_err(|e| StorageError::QueryFailed(e.to_string()))?;

        Ok(Self {
            db_path: db_path_str,
            conn: Mutex::new(conn),
        })
    }

    /// 运行数据库迁移
    pub fn run_migrations(&self) -> Result<(), StorageError> {
        let conn = self.conn.lock().unwrap();

        // 创建 api_keys 表
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                encrypted_key TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                base_url TEXT,
                status TEXT NOT NULL DEFAULT 'Active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_used_at TEXT
            );
            "#,
        )
        .map_err(|e| StorageError::MigrationFailed(e.to_string()))?;

        // 其他表（对话、消息、Prompt 等）...
        // CREATE TABLE IF NOT EXISTS conversations ...;

        Ok(())
    }
}

impl StoragePort for SqliteStorageAdapter {
    fn init(&self) -> Result<(), StorageError> {
        self.run_migrations()
    }

    fn db_path(&self) -> &str {
        &self.db_path
    }
}
```

### 5.4 加解密实现

> 参考：`electron1/electron/core/adapters/storage/sqlite.adapter.ts` 中的 `KeyEncryptor` 类

```rust
// src-tauri/src/infra/crypto.rs

use std::sync::Mutex;

/// AES-256-GCM 加解密器
///
/// 参考 electron 项目中使用 crypto.scrypt + AES-256-GCM 的方案，
/// 在 Rust 中使用 ring 或 aes-gcm crate 实现。
pub struct Aes256Encryptor {
    key: Mutex<aes_gcm::Key<aes_gcm::Aes256Gcm>>,
}

impl Aes256Encryptor {
    /// 使用密码初始化加解密器
    ///
    /// 使用 scrypt 从密码派生 256-bit 密钥。
    pub fn new(password: &str) -> Result<Self, String> {
        use aes_gcm::{
            aead::{Aead, KeyInit},
            Aes256Gcm, Nonce,
        };
        use aes_gcm::key::Key;
        use scrypt::scrypt;

        // scrypt 参数
        let salt = b"easy-agent-salt"; // 可改为随机 salt 存储
        let params = scrypt::Params::new(14, 8, 1).map_err(|e| e.to_string())?;

        let mut key_bytes = [0u8; 32];
        scrypt(password.as_bytes(), salt, &params, &mut key_bytes)
            .map_err(|e| e.to_string())?;

        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        Ok(Self {
            key: Mutex::new(*key),
        })
    }

    /// 加密：返回格式为 "iv:auth_tag:ciphertext"（hex 编码）
    pub fn encrypt(&self, plaintext: &str) -> Result<String, String> {
        use aes_gcm::{
            aead::{Aead, KeyInit, OsRng},
            Aes256Gcm, Nonce,
        };
        use aes_gcm::key::Key;

        let key = *self.key.lock().unwrap();
        let cipher = Aes256Gcm::new(&key);

        // 生成 96-bit 随机 nonce
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| e.to_string())?;

        Ok(format!(
            "{}:{}:{}",
            hex::encode(nonce_bytes),
            hex::encode(&ciphertext[..12]), // auth tag 长度 12 字节
            hex::encode(&ciphertext[12..])
        ))
    }

    /// 解密：输入格式为 "iv:auth_tag:ciphertext"
    pub fn decrypt(&self, data: &str) -> Result<String, String> {
        use aes_gcm::{
            aead::{Aead, KeyInit},
            Aes256Gcm, Nonce,
        };

        let parts: Vec<&str> = data.split(':').collect();
        if parts.len() != 3 {
            return Err("Invalid ciphertext format".to_string());
        }

        let key = *self.key.lock().unwrap();
        let cipher = Aes256Gcm::new(&key);

        let nonce_bytes = hex::decode(parts[0]).map_err(|e| e.to_string())?;
        let auth_tag = hex::decode(parts[1]).map_err(|e| e.to_string())?;
        let ciphertext = hex::decode(parts[2]).map_err(|e| e.to_string())?;

        // 拼接 auth_tag + ciphertext
        let mut combined = Vec::with_capacity(auth_tag.len() + ciphertext.len());
        combined.extend_from_slice(&auth_tag);
        combined.extend_from_slice(&ciphertext);

        let nonce = Nonce::from_slice(&nonce_bytes);
        let plaintext = cipher
            .decrypt(nonce, combined.as_ref())
            .map_err(|e| e.to_string())?;

        String::from_utf8(plaintext).map_err(|e| e.to_string())
    }
}

impl crate::application::api_key::Encryptor for Aes256Encryptor {
    fn encrypt(&self, plaintext: &str) -> Result<String, String> {
        self.encrypt(plaintext)
    }

    fn decrypt(&self, ciphertext: &str) -> Result<String, String> {
        self.decrypt(ciphertext)
    }
}
```

### 5.5 Infrastructure 模块导出

```rust
// src-tauri/src/infra/storage/mod.rs

pub mod sqlite;

pub use sqlite::SqliteStorageAdapter;
```

```rust
// src-tauri/src/infra/mod.rs

pub mod crypto;
pub mod storage;

pub use storage::SqliteStorageAdapter;
```

---

## 六、Services 层（依赖注入与组装）

### 6.1 API Key Service 组装

> 参考：`electron1/electron/core/index.ts` 中的 `EasyAgentCore` 类（依赖注入部分）

```rust
// src-tauri/src/services/api_key/service.rs

use std::sync::Arc;

use crate::application::api_key::{
    ApiKeyService, ApiKeyServiceTrait, CreateApiKeyDto, UpdateApiKeyMetaDto,
    UpdateApiKeyDto,
};
use crate::domain::api_key::{ApiKey, ApiKeyId, ApiKeyRepository, LlmProvider};
use crate::infra::{storage::SqliteStorageAdapter, Aes256Encryptor};

/// API Key 服务Facade
///
/// 封装了 Application 层的业务服务和 Infrastructure 层的持久化实现，
/// 供 Commands 层（Tauri 命令）直接调用。
pub struct ApiKeyFacade {
    service: Arc<dyn ApiKeyServiceTrait>,
}

impl ApiKeyFacade {
    /// 从 SQLite 存储构建 Facade
    pub fn from_sqlite(db_path: &str, master_password: &str) -> Result<Self, String> {
        // ============ Infrastructure 层 ============
        let storage = SqliteStorageAdapter::new(db_path)
            .map_err(|e| e.to_string())?;
        storage.init().map_err(|e| e.to_string())?;

        let repository = crate::infra::storage::sqlite::SqliteApiKeyAdapter::new(db_path)
            .map_err(|e| e.to_string())?;
        repository.init_schema().map_err(|e| e.to_string())?;

        let encryptor = Aes256Encryptor::new(master_password)?;

        // ============ Application 层 ============
        let service = ApiKeyService::new(Arc::new(repository), Arc::new(encryptor));

        Ok(Self {
            service: Arc::new(service),
        })
    }

    // ============ Facade 方法（供 Commands 调用） ============

    /// 创建 API Key
    pub fn create(&self, dto: CreateApiKeyDto) -> Result<ApiKey, String> {
        self.service
            .create_api_key(dto.name, dto.key, dto.provider, dto.model, dto.base_url)
            .map_err(|e| e.to_string())
    }

    /// 获取单个 API Key
    pub fn get(&self, id: &str) -> Result<Option<ApiKey>, String> {
        let api_key_id = ApiKeyId::from_string(id.to_string());
        self.service
            .get_api_key(&api_key_id)
            .map_err(|e| e.to_string())
    }

    /// 获取解密后的 Key
    pub fn get_decrypted(&self, id: &str) -> Result<Option<String>, String> {
        let api_key_id = ApiKeyId::from_string(id.to_string());
        self.service
            .get_decrypted_key(&api_key_id)
            .map_err(|e| e.to_string())
    }

    /// 列出所有 API Key
    pub fn list(&self) -> Result<Vec<ApiKey>, String> {
        self.service.list_api_keys().map_err(|e| e.to_string())
    }

    /// 列出所有启用的 API Key
    pub fn list_enabled(&self) -> Result<Vec<ApiKey>, String> {
        self.service
            .list_enabled_api_keys()
            .map_err(|e| e.to_string())
    }

    /// 按提供商列出
    pub fn list_by_provider(&self, provider: &str) -> Result<Vec<ApiKey>, String> {
        self.service
            .list_api_keys_by_provider(provider)
            .map_err(|e| e.to_string())
    }

    /// 更新 Key 密钥
    pub fn update_key(&self, id: &str, dto: UpdateApiKeyDto) -> Result<bool, String> {
        let api_key_id = ApiKeyId::from_string(id.to_string());
        self.service
            .update_key(&api_key_id, dto.key)
            .map_err(|e| e.to_string())
    }

    /// 更新元信息
    pub fn update_meta(&self, id: &str, dto: UpdateApiKeyMetaDto) -> Result<bool, String> {
        let api_key_id = ApiKeyId::from_string(id.to_string());
        self.service
            .update_meta(&api_key_id, dto.name, dto.model, dto.base_url)
            .map_err(|e| e.to_string())
    }

    /// 启用/禁用
    pub fn set_enabled(&self, id: &str, enabled: bool) -> Result<bool, String> {
        let api_key_id = ApiKeyId::from_string(id.to_string());
        self.service
            .set_enabled(&api_key_id, enabled)
            .map_err(|e| e.to_string())
    }

    /// 删除
    pub fn delete(&self, id: &str) -> Result<bool, String> {
        let api_key_id = ApiKeyId::from_string(id.to_string());
        self.service
            .delete_api_key(&api_key_id)
            .map_err(|e| e.to_string())
    }

    /// 获取当前激活的 Key
    pub fn get_active(&self) -> Result<Option<ApiKey>, String> {
        self.service
            .get_active_api_key()
            .map_err(|e| e.to_string())
    }
}
```

### 6.2 Services 模块导出

```rust
// src-tauri/src/services/api_key/mod.rs

pub mod service;

pub use service::ApiKeyFacade;
```

```rust
// src-tauri/src/services/mod.rs

pub mod api_key;

pub use api_key::ApiKeyFacade;
```

---

## 七、Commands 层（暴露给前端）

> 参考：`electron1/electron/ipc/config.handler.ts`

```rust
// src-tauri/src/commands/api_key.rs

use tauri::State;

use crate::application::api_key::{
    ApiKeyResponseDto, CreateApiKeyDto, CreateApiKeyResultDto, UpdateApiKeyDto,
    UpdateApiKeyMetaDto,
};
use crate::domain::api_key::ApiKey;
use crate::services::api_key::ApiKeyFacade;

/// 应用状态（存储 Facade 实例）
pub struct AppState {
    pub api_key_facade: ApiKeyFacade,
}

// ==================== Tauri Commands ====================

/// 获取所有 API Key
#[tauri::command]
pub fn list_api_keys(state: State<AppState>) -> Result<Vec<ApiKeyResponseDto>, String> {
    let keys = state.api_key_facade.list()?;
    Ok(keys.iter().map(ApiKeyResponseDto::from).collect())
}

/// 获取指定 ID 的 API Key（不含明文）
#[tauri::command]
pub fn get_api_key(id: String, state: State<AppState>) -> Result<Option<ApiKeyResponseDto>, String> {
    let key = state.api_key_facade.get(&id)?;
    Ok(key.as_ref().map(ApiKeyResponseDto::from))
}

/// 获取解密后的明文 Key（敏感操作，可加权限限制）
#[tauri::command]
pub fn get_decrypted_key(id: String, state: State<AppState>) -> Result<Option<String>, String> {
    state.api_key_facade.get_decrypted(&id)
}

/// 创建新的 API Key
#[tauri::command]
pub fn create_api_key(dto: CreateApiKeyDto, state: State<AppState>) -> Result<CreateApiKeyResultDto, String> {
    let api_key = state.api_key_facade.create(dto.clone())?;
    let decrypted = state.api_key_facade.get_decrypted(&api_key.id.0)?
        .ok_or_else(|| "Failed to decrypt newly created key".to_string())?;
    Ok(CreateApiKeyResultDto {
        api_key: ApiKeyResponseDto::from(&api_key),
        decrypted_key: decrypted,
    })
}

/// 更新 API Key 密钥
#[tauri::command]
pub fn update_api_key_key(id: String, dto: UpdateApiKeyDto, state: State<AppState>) -> Result<bool, String> {
    state.api_key_facade.update_key(&id, dto)
}

/// 更新 API Key 元信息
#[tauri::command]
pub fn update_api_key_meta(id: String, dto: UpdateApiKeyMetaDto, state: State<AppState>) -> Result<bool, String> {
    state.api_key_facade.update_meta(&id, dto)
}

/// 启用/禁用 API Key
#[tauri::command]
pub fn set_api_key_enabled(id: String, enabled: bool, state: State<AppState>) -> Result<bool, String> {
    state.api_key_facade.set_enabled(&id, enabled)
}

/// 删除 API Key
#[tauri::command]
pub fn delete_api_key(id: String, state: State<AppState>) -> Result<bool, String> {
    state.api_key_facade.delete(&id)
}

/// 获取当前激活的 API Key
#[tauri::command]
pub fn get_active_api_key(state: State<AppState>) -> Result<Option<ApiKeyResponseDto>, String> {
    let key = state.api_key_facade.get_active()?;
    Ok(key.as_ref().map(ApiKeyResponseDto::from))
}

/// 获取指定提供商的 API Key 列表
#[tauri::command]
pub fn list_api_keys_by_provider(provider: String, state: State<AppState>) -> Result<Vec<ApiKeyResponseDto>, String> {
    let keys = state.api_key_facade.list_by_provider(&provider)?;
    Ok(keys.iter().map(ApiKeyResponseDto::from).collect())
}
```

### 7.1 Commands 模块导出

```rust
// src-tauri/src/commands/mod.rs

pub mod api_key;

pub use api_key::*;
```

---

## 八、lib.rs 组装

> 参考：`electron1/electron/main.ts` 中的 `createWindow()` 和 `app.whenReady()` 部分

```rust
// src-tauri/src/lib.rs

mod application;
mod commands;
mod domain;
mod infra;
mod services;

use commands::api_key::{
    self, create_api_key, delete_api_key, get_active_api_key, get_api_key,
    get_decrypted_key, list_api_key_keys, list_api_keys_by_provider, set_api_key_enabled,
    update_api_key_key, update_api_key_meta, AppState,
};
use services::api_key::ApiKeyFacade;

/// 应用数据目录
fn get_db_path(app: &tauri::AppHandle) -> String {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    std::fs::create_dir_all(&data_dir).expect("Failed to create data dir");
    data_dir
        .join("easy-agent.db")
        .to_str()
        .unwrap()
        .to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let db_path = get_db_path(app.handle());

            // ============ 初始化 Services 层 ============
            // master_password 应从安全存储或用户输入获取
            let master_password = "easy-agent-master-key"; // TODO: 改进为安全存储
            let api_key_facade = ApiKeyFacade::from_sqlite(&db_path, master_password)
                .expect("Failed to initialize API Key facade");

            // ============ 注入应用状态 ============
            app.manage(AppState {
                api_key_facade,
            });

            println!("[EasyAgent] Application initialized, db_path: {}", db_path);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_api_keys,
            get_api_key,
            get_decrypted_key,
            create_api_key,
            update_api_key_key,
            update_api_key_meta,
            set_api_key_enabled,
            delete_api_key,
            get_active_api_key,
            list_api_keys_by_provider,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 九、数据流总结

```
前端调用
   │
   ▼
lib.rs (Tauri setup + manage State)
   │
   ▼
Commands (api_key.rs)
   │  #[tauri::command]
   │  fn list_api_keys(state: State<AppState>) { ... }
   │
   ▼
Services (services/api_key/service.rs)
   │  ApiKeyFacade { service: Arc<dyn ApiKeyServiceTrait> }
   │  依赖注入：Arc<Repository> + Arc<Encryptor>
   │
   ▼
Application (application/api_key/service.rs)
   │  ApiKeyService<R, E>
   │  业务逻辑：验证 → 加密 → 编排 Repository
   │
   ▼
Domain (domain/api_key/)
   │  entity.rs     → ApiKey 实体（含业务方法）
   │  repository.rs → trait ApiKeyRepository（接口）
   │  service_trait.rs → trait ApiKeyServiceTrait（接口）
   │
   ▼
Infrastructure (infra/storage/)
   │  SqliteApiKeyAdapter (实现 ApiKeyRepository)
   │  SqliteStorageAdapter (实现 StoragePort)
   │  Aes256Encryptor (实现 Encryptor)
   │
   ▼
SQLite 数据库
```

---

## 十、与旧工程 `electron1` 的对应关系

| 六边形层级 | electron1 项目 | 当前 Rust/Tauri 项目 |
|---|---|---|
| **Domain 实体** | `core/domain/entities/ApiKey.ts` | `domain/api_key/entity.rs` |
| **Domain 类型** | `core/domain/types.ts` | `domain/api_key/entity.rs`（枚举等） |
| **持久化 Port** | `core/ports/persistence/ApiKeyRepository.ts` | `domain/api_key/repository.rs` |
| **业务 Port** | 无单独文件（业务在 LLMManager 中） | `domain/api_key/service_trait.rs` |
| **DTO** | `core/ports/storage.port.ts` (CreateApiKeyDTO) | `application/api_key/dto.rs` |
| **Application** | `core/application/LLMManager.ts` | `application/api_key/service.rs` |
| **Persistence Adapter** | `core/adapters/persistence/SQLiteApiKeyAdapter.ts` | `infra/storage/sqlite/api_key_adapter.rs` |
| **Storage Adapter** | `core/adapters/storage/sqlite.adapter.ts` | `infra/storage/sqlite/mod.rs` |
| **加解密** | `sqlite.adapter.ts` 中的 `KeyEncryptor` 类 | `infra/crypto.rs` |
| **Services 组装** | `core/index.ts` 中的 `EasyAgentCore` | `services/api_key/service.rs` + `lib.rs` |
| **Commands/IPC** | `ipc/config.handler.ts` | `commands/api_key.rs` |
