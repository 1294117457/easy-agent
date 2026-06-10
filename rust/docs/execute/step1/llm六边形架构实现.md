# LLM 六边形架构实现

## 1. 名词解释：InputPort vs OutputPort（回顾）

| 端口类型 | 含义 | 方向 | 调用者 |
|---|---|---|---|
| **InputPort**（Driving Port） | 核心域暴露给外部的接口 | 外部 → 核心 | Tauri Commands / Agent / Graph |
| **OutputPort**（Driven Port） | 核心域需要外部能力时的接口 | 核心 → 外部 | Application Service |

## 2. 目录结构

```
src-tauri/src/
├── domain/
│   └── llm/
│       ├── mod.rs              # 模块入口
│       ├── LlmEntity.rs         # 实体（配置 + 消息 + 响应）
│       ├── LlmInputPort.rs     # 输入端口（外部驱动核心的接口）
│       └── LlmOutputPort.rs    # 输出端口（核心依赖外部能力的接口）
├── application/
│   └── llm/
│       ├── mod.rs
│       └── LlmApplication.rs     # 应用服务（实现 InputPort，调用 OutputPort）
├── infra/
│   ├── persistence/
│   │   └── sqlite.rs            # SQLite 基础设施（已在 apikey 中共用）
│   └── llm/
│       ├── mod.rs
│       ├── LlmInputAdapter.rs      # 输入适配器（Tauri Commands / Agent 调用 InputPort）
│       └── LlmOutputAdapter.rs     # 输出适配器（实现 OutputPort，供 Application 注入）
```

## 3. Domain（领域层）

### 3.1 Entity（LlmEntity.rs）

```rust
// src-tauri/src/domain/llm/LlmEntity.rs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::apikey::ApikeyEntity::{ApiKeyId, LlmProvider};

// ==================== 值对象 ====================

/// LLM 配置唯一标识符（值对象）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LlmConfigId(pub String);

impl LlmConfigId {
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

impl Default for LlmConfigId {
    fn default() -> Self {
        Self::new()
    }
}

/// LLM 采样参数（值对象）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmSamplingParams {
    pub temperature: f32,    // 默认 0.7，范围 0.0~2.0
    pub top_p: f32,          // 默认 1.0，范围 0.0~1.0
    pub max_tokens: u32,     // 默认 4096
    pub stop: Option<Vec<String>>,
}

impl Default for LlmSamplingParams {
    fn default() -> Self {
        Self {
            temperature: 0.7,
            top_p: 1.0,
            max_tokens: 4096,
            stop: None,
        }
    }
}

/// 消息角色
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MessageRole {
    System,
    User,
    Assistant,
    Tool,
}

/// 单条消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: MessageRole,
    pub content: String,
    pub tool_call_id: Option<String>,
    pub name: Option<String>,
}

impl Message {
    pub fn system(content: &str) -> Self {
        Self { role: MessageRole::System, content: content.to_string(), tool_call_id: None, name: None }
    }

    pub fn user(content: &str) -> Self {
        Self { role: MessageRole::User, content: content.to_string(), tool_call_id: None, name: None }
    }

    pub fn assistant(content: &str) -> Self {
        Self { role: MessageRole::Assistant, content: content.to_string(), tool_call_id: None, name: None }
    }

    pub fn tool(content: &str, tool_call_id: &str) -> Self {
        Self { role: MessageRole::Tool, content: content.to_string(), tool_call_id: Some(tool_call_id.to_string()), name: None }
    }

    pub fn to_openai_format(&self) -> serde_json::Value {
        let role_str = match self.role {
            MessageRole::System => "system",
            MessageRole::User => "user",
            MessageRole::Assistant => "assistant",
            MessageRole::Tool => "tool",
        };
        let mut map = serde_json::json!({
            "role": role_str,
            "content": self.content,
        });
        if let Some(id) = &self.tool_call_id {
            map["tool_call_id"] = serde_json::json!(id);
        }
        if let Some(name) = &self.name {
            map["name"] = serde_json::json!(name);
        }
        map
    }
}

/// Token 使用量
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// 工具调用
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: String, // JSON 字符串
}

/// LLM 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletion {
    pub model: String,
    pub content: String,
    pub usage: Usage,
    pub finish_reason: String,
    pub tool_calls: Option<Vec<ToolCall>>,
}

/// 工具定义（用于 function calling / tool use）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value, // JSON Schema
}

// ==================== 实体 ====================

/// LLM 配置实体
///
/// 代表一个 LLM 实例的配置，包含关联的 ApiKey 和采样参数。
/// 一个 ApiKey 可以对应多个 LLM 配置（不同模型）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    pub id: LlmConfigId,
    pub name: String,
    /// 关联的 ApiKey ID
    pub api_key_id: ApiKeyId,
    pub provider: LlmProvider,
    /// 模型名称（如 gpt-4o、claude-sonnet-4-20250514、qwen-turbo）
    pub model: String,
    /// 自定义 API 地址（覆盖 ApiKey 的 base_url）
    pub base_url: Option<String>,
    pub sampling_params: LlmSamplingParams,
    pub is_default: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl LlmConfig {
    pub fn new(
        name: String,
        api_key_id: ApiKeyId,
        provider: LlmProvider,
        model: String,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: LlmConfigId::new(),
            name,
            api_key_id,
            provider,
            model,
            base_url: None,
            sampling_params: LlmSamplingParams::default(),
            is_default: false,
            is_active: true,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn reconstitute(
        id: LlmConfigId,
        name: String,
        api_key_id: ApiKeyId,
        provider: LlmProvider,
        model: String,
        base_url: Option<String>,
        sampling_params: LlmSamplingParams,
        is_default: bool,
        is_active: bool,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    ) -> Self {
        Self { id, name, api_key_id, provider, model, base_url, sampling_params, is_default, is_active, created_at, updated_at }
    }

    pub fn is_active(&self) -> bool {
        self.is_active
    }

    pub fn activate(&mut self) {
        self.is_active = true;
        self.updated_at = Utc::now();
    }

    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.updated_at = Utc::now();
    }

    pub fn set_as_default(&mut self) {
        self.is_default = true;
        self.updated_at = Utc::now();
    }

    pub fn update_sampling_params(&mut self, params: LlmSamplingParams) {
        self.sampling_params = params;
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
}
```

### 3.2 InputPort（LlmInputPort.rs）

InputPort 是**核心域暴露给外部调用的接口**，由 Application 层实现。

```rust
// src-tauri/src/domain/llm/LlmInputPort.rs

use crate::domain::llm::LlmEntity::{
    ChatCompletion, LlmConfig, LlmConfigId, LlmProvider,
    LlmSamplingParams, Message, ToolDefinition,
};

/// LLM 输入端口（Driving Port / InputPort）
///
/// 定义外部（Tauri Commands / Agent / Graph）可以调用核心域能力的接口契约。
/// 由 Application 层（LlmApplication）实现。
pub trait LlmInputPort: Send + Sync {
    // ==================== 配置管理 ====================

    /// 创建 LLM 配置
    async fn create_config(
        &self,
        name: String,
        api_key_id: String,
        provider: LlmProvider,
        model: String,
        base_url: Option<String>,
        sampling_params: Option<LlmSamplingParams>,
    ) -> Result<LlmConfig, LlmInputError>;

    /// 获取配置
    async fn get_config(&self, id: &str) -> Result<Option<LlmConfig>, LlmInputError>;

    /// 列出所有配置
    async fn list_configs(&self) -> Result<Vec<LlmConfig>, LlmInputError>;

    /// 更新配置
    async fn update_config(
        &self,
        id: &str,
        name: Option<String>,
        model: Option<String>,
        base_url: Option<String>,
        sampling_params: Option<LlmSamplingParams>,
        is_default: Option<bool>,
        is_active: Option<bool>,
    ) -> Result<LlmConfig, LlmInputError>;

    /// 删除配置
    async fn delete_config(&self, id: &str) -> Result<(), LlmInputError>;

    // ==================== 聊天 ====================

    /// 执行聊天（按配置 ID）
    async fn chat(
        &self,
        llm_config_id: &str,
        messages: Vec<Message>,
    ) -> Result<ChatCompletion, LlmInputError>;

    /// 执行聊天（按 Provider，使用默认配置）
    async fn chat_by_provider(
        &self,
        provider: LlmProvider,
        messages: Vec<Message>,
    ) -> Result<ChatCompletion, LlmInputError>;

    /// 执行带工具调用的聊天
    async fn chat_with_tools(
        &self,
        llm_config_id: &str,
        messages: Vec<Message>,
        tools: Vec<ToolDefinition>,
    ) -> Result<ChatCompletion, LlmInputError>;
}

/// 输入端口错误类型
#[derive(Debug, thiserror::Error)]
pub enum LlmInputError {
    #[error("Config not found: {0}")]
    ConfigNotFound(String),

    #[error("ApiKey not found or inactive: {0}")]
    ApiKeyNotFound(String),

    #[error("Crypto error: {0}")]
    CryptoError(String),

    #[error("Chat error: {0}")]
    ChatError(String),

    #[error("Repository error: {0}")]
    RepoError(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),
}
```

### 3.3 OutputPort（LlmOutputPort.rs）

OutputPort 是**核心域需要外部能力时的接口契约**，由 Adapter 层实现并注入。

```rust
// src-tauri/src/domain/llm/LlmOutputPort.rs

use crate::domain::llm::LlmEntity::{
    ChatCompletion, LlmConfig, LlmConfigId, LlmProvider, LlmSamplingParams, Message, ToolDefinition,
};
use crate::domain::apikey::ApikeyEntity::ApiKey;

/// LLM 配置仓储输出端口（Driven Port / OutputPort）
///
/// 定义 LLM 配置持久化能力的接口契约。
/// 由 Adapter 层（SqliteLlmOutputAdapter）实现并注入到 Application。
pub trait LlmConfigRepositoryOutputPort: Send + Sync {
    fn find_by_id(&self, id: &LlmConfigId) -> impl Future<Output = Result<Option<LlmConfig>, LlmRepoError>> + Send;

    fn find_all(&self) -> impl Future<Output = Result<Vec<LlmConfig>, LlmRepoError>> + Send;

    fn find_by_provider(&self, provider: LlmProvider) -> impl Future<Output = Result<Vec<LlmConfig>, LlmRepoError>> + Send;

    fn find_by_api_key(&self, api_key_id: &str) -> impl Future<Output = Result<Vec<LlmConfig>, LlmRepoError>> + Send;

    fn save(&self, config: &LlmConfig) -> impl Future<Output = Result<(), LlmRepoError>> + Send;

    fn delete(&self, id: &LlmConfigId) -> impl Future<Output = Result<(), LlmRepoError>> + Send;

    fn find_default(&self) -> impl Future<Output = Result<Option<LlmConfig>, LlmRepoError>> + Send;

    fn unset_all_default(&self) -> impl Future<Output = Result<(), LlmRepoError>> + Send;
}

/// LLM 仓储错误
#[derive(Debug, thiserror::Error)]
pub enum LlmRepoError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),
}

/// 聊天客户端输出端口（Driven Port / OutputPort）
///
/// 定义与 LLM Provider 通信的能力契约。
/// 不同 Provider（OpenAI / Anthropic / Qwen）共用同一个接口，
/// 由 Adapter 层（LlmHttpOutputAdapter）实现。
pub trait ChatClientOutputPort: Send + Sync {
    /// 发送聊天请求
    async fn chat(
        &self,
        base_url: &str,
        api_key: &str,
        messages: Vec<Message>,
        model: &str,
        temperature: f32,
        top_p: f32,
        max_tokens: u32,
        stop: Option<Vec<String>>,
    ) -> Result<ChatCompletion, ChatClientError>;

    /// 发送带工具调用的聊天请求
    async fn chat_with_tools(
        &self,
        base_url: &str,
        api_key: &str,
        messages: Vec<Message>,
        model: &str,
        temperature: f32,
        top_p: f32,
        max_tokens: u32,
        tools: Vec<ToolDefinition>,
    ) -> Result<ChatCompletion, ChatClientError>;
}

/// 聊天客户端错误
#[derive(Debug, thiserror::Error)]
pub enum ChatClientError {
    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Authentication failed: {0}")]
    AuthError(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Context length exceeded")]
    ContextLengthExceeded,

    #[error("Unknown error: {0}")]
    Unknown(String),
}
```

### 3.4 mod.rs（domain/llm）

```rust
// src-tauri/src/domain/llm/mod.rs

pub mod LlmEntity;
pub mod LlmInputPort;
pub mod LlmOutputPort;

pub use LlmEntity::{
    ChatCompletion, LlmConfig, LlmConfigId, LlmSamplingParams,
    Message, MessageRole, ToolCall, ToolDefinition, Usage,
};
pub use LlmInputPort::{LlmInputPort, LlmInputError};
pub use LlmOutputPort::{
    LlmConfigRepositoryOutputPort, LlmRepoError,
    ChatClientOutputPort, ChatClientError,
};
```

## 4. Application（应用层）

### 4.1 Application（LlmApplication.rs）

```rust
// src-tauri/src/application/llm/LlmApplication.rs

use std::sync::Arc;
use thiserror::Error;

use crate::domain::apikey::ApikeyEntity::ApiKeyId;
use crate::domain::apikey::ApikeyOutputPort::CryptoServiceOutputPort;
use crate::domain::llm::{
    ChatCompletion, LlmConfig, LlmConfigId, LlmProvider, LlmSamplingParams,
    Message, ToolDefinition,
    LlmInputPort, LlmInputError,
    LlmConfigRepositoryOutputPort, LlmRepoError,
    ChatClientOutputPort, ChatClientError,
};

/// LLM 应用服务
///
/// 实现 LlmInputPort，编排 LlmConfigRepositoryOutputPort、ChatClientOutputPort。
/// 由 Tauri Commands（InputAdapter）调用。
pub struct LlmApplication {
    llm_repo: Arc<dyn LlmConfigRepositoryOutputPort>,
    apikey_repo: Arc<dyn crate::domain::apikey::ApikeyOutputPort::ApikeyRepositoryOutputPort>,
    crypto: Arc<dyn CryptoServiceOutputPort>,
    chat_client: Arc<dyn ChatClientOutputPort>,
}

impl LlmApplication {
    pub fn new(
        llm_repo: Arc<dyn LlmConfigRepositoryOutputPort>,
        apikey_repo: Arc<dyn crate::domain::apikey::ApikeyOutputPort::ApikeyRepositoryOutputPort>,
        crypto: Arc<dyn CryptoServiceOutputPort>,
        chat_client: Arc<dyn ChatClientOutputPort>,
    ) -> Self {
        Self { llm_repo, apikey_repo, crypto, chat_client }
    }

    fn map_repo_error(e: LlmRepoError) -> LlmInputError {
        LlmInputError::RepoError(e.to_string())
    }

    fn map_chat_error(e: ChatClientError) -> LlmInputError {
        LlmInputError::ChatError(e.to_string())
    }

    /// 解析配置并获取解密后的 API Key
    async fn resolve_config_and_key(&self, config_id: &str)
        -> Result<(LlmConfig, String), LlmInputError> {

        let config = self.llm_repo
            .find_by_id(&LlmConfigId::from_string(config_id.to_string()))
            .await
            .map_err(Self::map_repo_error)?
            .ok_or_else(|| LlmInputError::ConfigNotFound(config_id.to_string()))?;

        let apikey = self.apikey_repo
            .find_by_id(&config.api_key_id)
            .await
            .map_err(Self::map_repo_error)?
            .ok_or_else(|| LlmInputError::ApiKeyNotFound(config.api_key_id.as_str().to_string()))?;

        if !apikey.is_active() {
            return Err(LlmInputError::ApiKeyNotFound(
                format!("ApiKey {} is inactive", apikey.id.as_str())
            ));
        }

        let decrypted_key = self.crypto
            .decrypt(&apikey.encrypted_key)
            .map_err(|e| LlmInputError::CryptoError(e.to_string()))?;

        Ok((config, decrypted_key))
    }

    /// 执行实际的 HTTP 聊天调用
    async fn do_chat(
        &self,
        config: &LlmConfig,
        api_key: &str,
        messages: Vec<Message>,
        tools: Option<Vec<ToolDefinition>>,
    ) -> Result<ChatCompletion, LlmInputError> {
        let base_url = config.base_url.as_deref()
            .or(apikey::ApikeyEntity::LlmProvider::default_base_url(&config.provider))
            .unwrap_or("https://api.openai.com");

        let result = if let Some(tools) = tools {
            self.chat_client.chat_with_tools(
                base_url,
                api_key,
                messages,
                &config.model,
                config.sampling_params.temperature,
                config.sampling_params.top_p,
                config.sampling_params.max_tokens,
                tools,
            ).await
        } else {
            self.chat_client.chat(
                base_url,
                api_key,
                messages,
                &config.model,
                config.sampling_params.temperature,
                config.sampling_params.top_p,
                config.sampling_params.max_tokens,
                config.sampling_params.stop.clone(),
            ).await
        };

        result.map_err(Self::map_chat_error)
    }
}

impl LlmInputPort for LlmApplication {
    // ==================== 配置管理 ====================

    async fn create_config(
        &self,
        name: String,
        api_key_id: String,
        provider: LlmProvider,
        model: String,
        base_url: Option<String>,
        sampling_params: Option<LlmSamplingParams>,
    ) -> Result<LlmConfig, LlmInputError> {
        self.apikey_repo
            .find_by_id(&ApiKeyId::from_string(api_key_id.clone()))
            .await
            .map_err(Self::map_repo_error)?
            .ok_or_else(|| LlmInputError::ApiKeyNotFound(api_key_id))?;

        let mut config = LlmConfig::new(
            name,
            ApiKeyId::from_string(api_key_id),
            provider,
            model,
        );
        config.set_base_url(base_url);
        if let Some(params) = sampling_params {
            config.update_sampling_params(params);
        }

        self.llm_repo.save(&config)
            .await
            .map_err(Self::map_repo_error)?;

        Ok(config)
    }

    async fn get_config(&self, id: &str) -> Result<Option<LlmConfig>, LlmInputError> {
        self.llm_repo
            .find_by_id(&LlmConfigId::from_string(id.to_string()))
            .await
            .map_err(Self::map_repo_error)
    }

    async fn list_configs(&self) -> Result<Vec<LlmConfig>, LlmInputError> {
        self.llm_repo.find_all()
            .await
            .map_err(Self::map_repo_error)
    }

    async fn update_config(
        &self,
        id: &str,
        name: Option<String>,
        model: Option<String>,
        base_url: Option<String>,
        sampling_params: Option<LlmSamplingParams>,
        is_default: Option<bool>,
        is_active: Option<bool>,
    ) -> Result<LlmConfig, LlmInputError> {
        let mut config = self.llm_repo
            .find_by_id(&LlmConfigId::from_string(id.to_string()))
            .await
            .map_err(Self::map_repo_error)?
            .ok_or_else(|| LlmInputError::ConfigNotFound(id.to_string()))?;

        if let Some(n) = name {
            config.name = n;
            config.updated_at = chrono::Utc::now();
        }

        if let Some(m) = model {
            config.update_model(m);
        }

        if let Some(url) = base_url {
            config.set_base_url(Some(url));
        }

        if let Some(params) = sampling_params {
            config.update_sampling_params(params);
        }

        if let Some(is_def) = is_default {
            if is_def {
                self.llm_repo.unset_all_default().await.map_err(Self::map_repo_error)?;
                config.set_as_default();
            }
        }

        if let Some(active) = is_active {
            if active { config.activate(); } else { config.deactivate(); }
        }

        self.llm_repo.save(&config)
            .await
            .map_err(Self::map_repo_error)?;

        Ok(config)
    }

    async fn delete_config(&self, id: &str) -> Result<(), LlmInputError> {
        self.llm_repo
            .delete(&LlmConfigId::from_string(id.to_string()))
            .await
            .map_err(Self::map_repo_error)
    }

    // ==================== 聊天 ====================

    async fn chat(
        &self,
        llm_config_id: &str,
        messages: Vec<Message>,
    ) -> Result<ChatCompletion, LlmInputError> {
        let (config, api_key) = self.resolve_config_and_key(llm_config_id).await?;
        self.do_chat(&config, &api_key, messages, None).await
    }

    async fn chat_by_provider(
        &self,
        provider: LlmProvider,
        messages: Vec<Message>,
    ) -> Result<ChatCompletion, LlmInputError> {
        let configs = self.llm_repo
            .find_by_provider(provider)
            .await
            .map_err(Self::map_repo_error)?;

        let config = configs
            .into_iter()
            .find(|c| c.is_active)
            .ok_or_else(|| LlmInputError::ConfigNotFound(
                format!("No active config for provider: {:?}", provider)
            ))?;

        let apikey = self.apikey_repo
            .find_by_id(&config.api_key_id)
            .await
            .map_err(Self::map_repo_error)?
            .ok_or_else(|| LlmInputError::ApiKeyNotFound(config.api_key_id.as_str().to_string()))?;

        if !apikey.is_active() {
            return Err(LlmInputError::ApiKeyNotFound(
                format!("ApiKey {} is inactive", apikey.id.as_str())
            ));
        }

        let api_key = self.crypto
            .decrypt(&apikey.encrypted_key)
            .map_err(|e| LlmInputError::CryptoError(e.to_string()))?;

        self.do_chat(&config, &api_key, messages, None).await
    }

    async fn chat_with_tools(
        &self,
        llm_config_id: &str,
        messages: Vec<Message>,
        tools: Vec<ToolDefinition>,
    ) -> Result<ChatCompletion, LlmInputError> {
        let (config, api_key) = self.resolve_config_and_key(llm_config_id).await?;
        self.do_chat(&config, &api_key, messages, Some(tools)).await
    }
}
```

### 4.2 mod.rs（application/llm）

```rust
// src-tauri/src/application/llm/mod.rs

pub mod LlmApplication;

pub use LlmApplication::LlmApplication;
```

## 5. Infra（基础设施层）

### 5.1 OutputAdapter（LlmOutputAdapter.rs）

实现 `LlmConfigRepositoryOutputPort`（持久化）和 `ChatClientOutputPort`（HTTP 聊天）。

```rust
// src-tauri/src/infra/llm/LlmOutputAdapter.rs

use async_trait::async_trait;
use rusqlite::{params, Connection};
use std::sync::Arc;

use crate::domain::apikey::ApikeyEntity::{ApiKeyId, LlmProvider};
use crate::domain::llm::{
    ChatCompletion, LlmConfig, LlmConfigId, LlmSamplingParams, Message, ToolCall, ToolDefinition, Usage,
    LlmConfigRepositoryOutputPort, LlmRepoError,
    ChatClientOutputPort, ChatClientError,
};

// ==================== LLM Config Repository Output Adapter ====================

/// SQLite 实现的 LLM 配置仓储适配器（OutputAdapter）
pub struct SqliteLlmConfigOutputAdapter {
    conn: Arc<Connection>,
}

impl SqliteLlmConfigOutputAdapter {
    pub fn new(conn: Arc<Connection>) -> Self {
        Self { conn }
    }

    pub fn init_table(&self) -> Result<(), LlmRepoError> {
        self.conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS llm_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                api_key_id TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                base_url TEXT,
                sampling_params TEXT NOT NULL,
                is_default INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
            )
            "#,
            [],
        ).map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    fn map_row(row: &rusqlite::Row) -> Result<LlmConfig, rusqlite::Error> {
        let params_str: String = row.column(6)?;
        let sampling_params: LlmSamplingParams = serde_json::from_str(&params_str)
            .unwrap_or_default();

        Ok(LlmConfig {
            id: LlmConfigId(row.column::<String>(0)?),
            name: row.column::<String>(1)?,
            api_key_id: ApiKeyId(row.column::<String>(2)?),
            provider: serde_json::from_str(&row.column::<String>(3)?)
                .unwrap_or(LlmProvider::OpenAi),
            model: row.column::<String>(4)?,
            base_url: row.column::<Option<String>>(5)?,
            sampling_params,
            is_default: row.column::<i32>(7)? != 0,
            is_active: row.column::<i32>(8)? != 0,
            created_at: row.column::<String>(9)?.parse().unwrap_or_default(),
            updated_at: row.column::<String>(10)?.parse().unwrap_or_default(),
        })
    }
}

#[async_trait]
impl LlmConfigRepositoryOutputPort for SqliteLlmConfigOutputAdapter {
    async fn find_by_id(&self, id: &LlmConfigId) -> Result<Option<LlmConfig>, LlmRepoError> {
        let conn = self.conn.clone();
        let id_str = id.as_str().to_string();

        tokio::task::spawn_blocking(move || {
            let mut stmt = conn.prepare(
                "SELECT id,name,api_key_id,provider,model,base_url,sampling_params,is_default,is_active,created_at,updated_at
                 FROM llm_configs WHERE id = ?"
            ).map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?;

            stmt.query_row([&id_str], Self::map_row)
                .optional()
                .map_err(|e| LlmRepoError::DatabaseError(e.to_string()))
        }).await.map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?
    }

    async fn find_all(&self) -> Result<Vec<LlmConfig>, LlmRepoError> {
        let conn = self.conn.clone();

        tokio::task::spawn_blocking(move || {
            let mut stmt = conn.prepare(
                "SELECT id,name,api_key_id,provider,model,base_url,sampling_params,is_default,is_active,created_at,updated_at
                 FROM llm_configs ORDER BY created_at DESC"
            ).map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?;

            let rows = stmt.query_map([], Self::map_row)
                .map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?;

            let mut configs = Vec::new();
            for row in rows {
                configs.push(row.map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?);
            }
            Ok(configs)
        }).await.map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?
    }

    async fn find_by_provider(&self, provider: LlmProvider) -> Result<Vec<LlmConfig>, LlmRepoError> {
        let conn = self.conn.clone();
        let provider_str = serde_json::to_string(&provider).unwrap();

        tokio::task::spawn_blocking(move || {
            let mut stmt = conn.prepare(
                "SELECT ... FROM llm_configs WHERE provider = ?"
            ).map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?;

            let rows = stmt.query_map([&provider_str], Self::map_row)
                .map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?;

            let mut configs = Vec::new();
            for row in rows {
                configs.push(row.map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?);
            }
            Ok(configs)
        }).await.map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?
    }

    async fn find_by_api_key(&self, api_key_id: &str) -> Result<Vec<LlmConfig>, LlmRepoError> {
        let conn = self.conn.clone();

        tokio::task::spawn_blocking(move || {
            let mut stmt = conn.prepare(
                "SELECT ... FROM llm_configs WHERE api_key_id = ?"
            ).map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?;

            let rows = stmt.query_map([api_key_id], Self::map_row)
                .map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?;

            let mut configs = Vec::new();
            for row in rows {
                configs.push(row.map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?);
            }
            Ok(configs)
        }).await.map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?
    }

    async fn save(&self, config: &LlmConfig) -> Result<(), LlmRepoError> {
        let conn = self.conn.clone();
        let provider_str = serde_json::to_string(&config.provider).unwrap();
        let params_str = serde_json::to_string(&config.sampling_params).unwrap();
        let config_clone = config.clone();

        tokio::task::spawn_blocking(move || {
            conn.execute(
                r#"
                INSERT INTO llm_configs (id,name,api_key_id,provider,model,base_url,sampling_params,is_default,is_active,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name, api_key_id=excluded.api_key_id,
                    provider=excluded.provider, model=excluded.model,
                    base_url=excluded.base_url, sampling_params=excluded.sampling_params,
                    is_default=excluded.is_default, is_active=excluded.is_active,
                    updated_at=excluded.updated_at
                "#,
                params![
                    config_clone.id.as_str(),
                    config_clone.name,
                    config_clone.api_key_id.as_str(),
                    provider_str,
                    config_clone.model,
                    config_clone.base_url,
                    params_str,
                    config_clone.is_default as i32,
                    config_clone.is_active as i32,
                    config_clone.created_at.to_rfc3339(),
                    config_clone.updated_at.to_rfc3339(),
                ],
            ).map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?;
            Ok(())
        }).await.map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?
    }

    async fn delete(&self, id: &LlmConfigId) -> Result<(), LlmRepoError> {
        let conn = self.conn.clone();
        let id_str = id.as_str().to_string();

        tokio::task::spawn_blocking(move || {
            conn.execute("DELETE FROM llm_configs WHERE id = ?", [&id_str])
                .map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?;
            Ok(())
        }).await.map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?
    }

    async fn find_default(&self) -> Result<Option<LlmConfig>, LlmRepoError> {
        let conn = self.conn.clone();

        tokio::task::spawn_blocking(move || {
            let mut stmt = conn.prepare(
                "SELECT ... FROM llm_configs WHERE is_default = 1 AND is_active = 1 LIMIT 1"
            ).map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?;

            stmt.query_row([], Self::map_row)
                .optional()
                .map_err(|e| LlmRepoError::DatabaseError(e.to_string()))
        }).await.map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?
    }

    async fn unset_all_default(&self) -> Result<(), LlmRepoError> {
        let conn = self.conn.clone();

        tokio::task::spawn_blocking(move || {
            conn.execute("UPDATE llm_configs SET is_default = 0", [])
                .map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?;
            Ok(())
        }).await.map_err(|e| LlmRepoError::DatabaseError(e.to_string()))?
    }
}

// ==================== HTTP Chat Client Output Adapter ====================

/// OpenAI 兼容接口的 HTTP 聊天客户端适配器（OutputAdapter）
///
/// 支持 OpenAI、Qwen、Groq、DeepSeek 等所有兼容 OpenAI API 格式的 Provider。
pub struct OpenAiHttpChatClientOutputAdapter {
    client: reqwest::Client,
}

impl OpenAiHttpChatClientOutputAdapter {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    fn map_error(status: u16, body: &str) -> ChatClientError {
        match status {
            401 | 403 => ChatClientError::AuthError(body.to_string()),
            429 => ChatClientError::RateLimitExceeded,
            400 => ChatClientError::InvalidRequest(body.to_string()),
            _ => ChatClientError::Unknown(body.to_string()),
        }
    }

    fn parse_completion(json: &serde_json::Value, model: &str) -> Result<ChatCompletion, ChatClientError> {
        let choices = json["choices"].as_array()
            .ok_or_else(|| ChatClientError::InvalidRequest("No choices in response".into()))?;

        let choice = choices.first()
            .ok_or_else(|| ChatClientError::InvalidRequest("Empty choices".into()))?;

        let content = choice["message"]["content"]
            .as_str().unwrap_or("").to_string();

        let finish_reason = choice["finish_reason"]
            .as_str().unwrap_or("stop").to_string();

        let usage = json.get("usage").map(|u| Usage {
            prompt_tokens: u["prompt_tokens"].as_u64().unwrap_or(0) as u32,
            completion_tokens: u["completion_tokens"].as_u64().unwrap_or(0) as u32,
            total_tokens: u["total_tokens"].as_u64().unwrap_or(0) as u32,
        }).unwrap_or(Usage { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });

        let tool_calls = choice["message"]["tool_calls"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|tc| {
                        Some(ToolCall {
                            id: tc["id"].as_str()?.to_string(),
                            name: tc["function"]["name"].as_str()?.to_string(),
                            arguments: tc["function"]["arguments"].as_str().unwrap_or("{}").to_string(),
                        })
                    })
                    .collect()
            });

        Ok(ChatCompletion {
            model: json["model"].as_str().unwrap_or(model).to_string(),
            content,
            usage,
            finish_reason,
            tool_calls,
        })
    }
}

impl ChatClientOutputPort for OpenAiHttpChatClientOutputAdapter {
    async fn chat(
        &self,
        base_url: &str,
        api_key: &str,
        messages: Vec<Message>,
        model: &str,
        temperature: f32,
        top_p: f32,
        max_tokens: u32,
        stop: Option<Vec<String>>,
    ) -> Result<ChatCompletion, ChatClientError> {
        let mut body = serde_json::json!({
            "model": model,
            "messages": messages.iter().map(|m| m.to_openai_format()).collect::<Vec<_>>(),
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
        });

        if let Some(stop_seqs) = stop {
            body["stop"] = serde_json::json!(stop_seqs);
        }

        let url = format!("{}/v1/chat/completions", base_url.trim_end_matches('/'));
        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ChatClientError::NetworkError(e.to_string()))?;

        let status = response.status().as_u16();
        let body_text = response.text().await.unwrap_or_default();

        if status != 200 {
            return Err(Self::map_error(status, &body_text));
        }

        let json: serde_json::Value = serde_json::from_str(&body_text)
            .map_err(|e| ChatClientError::InvalidRequest(e.to_string()))?;

        Self::parse_completion(&json, model)
    }

    async fn chat_with_tools(
        &self,
        base_url: &str,
        api_key: &str,
        messages: Vec<Message>,
        model: &str,
        temperature: f32,
        top_p: f32,
        max_tokens: u32,
        tools: Vec<ToolDefinition>,
    ) -> Result<ChatCompletion, ChatClientError> {
        let body = serde_json::json!({
            "model": model,
            "messages": messages.iter().map(|m| m.to_openai_format()).collect::<Vec<_>>(),
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
            "tools": tools,
        });

        let url = format!("{}/v1/chat/completions", base_url.trim_end_matches('/'));
        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ChatClientError::NetworkError(e.to_string()))?;

        let status = response.status().as_u16();
        let body_text = response.text().await.unwrap_or_default();

        if status != 200 {
            return Err(Self::map_error(status, &body_text));
        }

        let json: serde_json::Value = serde_json::from_str(&body_text)
            .map_err(|e| ChatClientError::InvalidRequest(e.to_string()))?;

        Self::parse_completion(&json, model)
    }
}
```

### 5.2 InputAdapter（LlmInputAdapter.rs）

实现 Tauri Commands 和 Agent/Graph 接口，作为 driving adapter 调用 InputPort。

```rust
// src-tauri/src/infra/llm/LlmInputAdapter.rs

use tauri;
use std::sync::Arc;

use crate::application::llm::LlmApplication;
use crate::domain::llm::{
    LlmInputPort, LlmInputError,
    LlmSamplingParams, Message, MessageRole, ToolDefinition,
};
use crate::domain::llm::LlmEntity::{ChatCompletion, LlmConfig};
use crate::domain::apikey::ApikeyEntity::LlmProvider;

// ==================== DTO ====================

#[derive(Debug, serde::Serialize)]
pub struct LlmConfigResponseDto {
    pub id: String,
    pub name: String,
    pub api_key_id: String,
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
    pub is_default: bool,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&LlmConfig> for LlmConfigResponseDto {
    fn from(c: &LlmConfig) -> Self {
        Self {
            id: c.id.as_str().to_string(),
            name: c.name.clone(),
            api_key_id: c.api_key_id.as_str().to_string(),
            provider: c.provider.as_str().to_string(),
            model: c.model.clone(),
            base_url: c.base_url.clone(),
            is_default: c.is_default,
            is_active: c.is_active,
            created_at: c.created_at.to_rfc3339(),
            updated_at: c.updated_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, serde::Serialize)]
pub struct ChatResponseDto {
    pub model: String,
    pub content: String,
    pub finish_reason: String,
    pub tool_calls: Option<Vec<ToolCallDto>>,
    pub usage: UsageDto,
}

#[derive(Debug, serde::Serialize)]
pub struct ToolCallDto {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, serde::Serialize)]
pub struct UsageDto {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

impl From<ChatCompletion> for ChatResponseDto {
    fn from(c: ChatCompletion) -> Self {
        Self {
            model: c.model,
            content: c.content,
            finish_reason: c.finish_reason,
            tool_calls: c.tool_calls.map(|tcs| {
                tcs.iter().map(|tc| ToolCallDto {
                    id: tc.id.clone(),
                    name: tc.name.clone(),
                    arguments: tc.arguments.clone(),
                }).collect()
            }),
            usage: UsageDto {
                prompt_tokens: c.usage.prompt_tokens,
                completion_tokens: c.usage.completion_tokens,
                total_tokens: c.usage.total_tokens,
            },
        }
    }
}

fn map_err(e: LlmInputError) -> String {
    e.to_string()
}

// ==================== Tauri Commands（外部 HTTP 调用）====================

#[tauri::command]
pub async fn llm_create_config(
    app: tauri::AppHandle,
    name: String,
    api_key_id: String,
    provider: String,
    model: String,
    base_url: Option<String>,
) -> Result<LlmConfigResponseDto, String> {
    let application = app.state::<Arc<dyn LlmInputPort>>();
    let prov = serde_json::from_str::<LlmProvider>(&format!("\"{}\"", provider))
        .map_err(|e| format!("Invalid provider: {}", e))?;

    application
        .create_config(name, api_key_id, prov, model, base_url, None)
        .await
        .map(LlmConfigResponseDto::from)
        .map_err(map_err)
}

#[tauri::command]
pub async fn llm_list_configs(
    app: tauri::AppHandle,
) -> Result<Vec<LlmConfigResponseDto>, String> {
    let application = app.state::<Arc<dyn LlmInputPort>>();
    application
        .list_configs()
        .await
        .map(|cs| cs.iter().map(LlmConfigResponseDto::from).collect())
        .map_err(map_err)
}

#[tauri::command]
pub async fn llm_chat(
    app: tauri::AppHandle,
    llm_config_id: String,
    messages: Vec<MessageDto>,
) -> Result<ChatResponseDto, String> {
    let application = app.state::<Arc<dyn LlmInputPort>>();
    let msgs: Vec<Message> = messages
        .iter()
        .map(|d| {
            let role = match d.role.as_str() {
                "system" => MessageRole::System,
                "user" => MessageRole::User,
                "assistant" => MessageRole::Assistant,
                "tool" => MessageRole::Tool,
                _ => MessageRole::User,
            };
            Message { role, content: d.content.clone(), tool_call_id: None, name: None }
        })
        .collect();

    application
        .chat(&llm_config_id, msgs)
        .await
        .map(ChatResponseDto::from)
        .map_err(map_err)
}

#[tauri::command]
pub async fn llm_delete_config(
    app: tauri::AppHandle,
    id: String,
) -> Result<(), String> {
    let application = app.state::<Arc<dyn LlmInputPort>>();
    application.delete_config(&id).await.map_err(map_err)
}

// ==================== Agent / Graph 接口（内部调用）====================

/// Agent/Graph 通过 Arc<dyn LlmInputPort> 直接调用，不走 Tauri Commands
pub struct LlmAgentInputAdapter {
    port: Arc<dyn LlmInputPort>,
}

impl LlmAgentInputAdapter {
    pub fn new(port: Arc<dyn LlmInputPort>) -> Self {
        Self { port }
    }

    pub async fn chat(&self, config_id: &str, messages: Vec<Message>) -> Result<ChatCompletion, LlmInputError> {
        self.port.chat(config_id, messages).await
    }

    pub async fn chat_with_tools(&self, config_id: &str, messages: Vec<Message>, tools: Vec<ToolDefinition>) -> Result<ChatCompletion, LlmInputError> {
        self.port.chat_with_tools(config_id, messages, tools).await
    }
}

#[derive(Debug, serde::Deserialize)]
pub struct MessageDto {
    pub role: String,
    pub content: String,
}
```

### 5.3 mod.rs（infra/llm）

```rust
// src-tauri/src/infra/llm/mod.rs

pub mod LlmInputAdapter;
pub mod LlmOutputAdapter;

pub use LlmInputAdapter::*;
pub use LlmOutputAdapter::*;
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
use application::llm::LlmApplication;
use domain::apikey::{
    ApikeyInputPort,
    ApikeyRepositoryOutputPort as ApikeyRepoPort,
    CryptoServiceOutputPort,
};
use domain::llm::{
    LlmInputPort,
    LlmConfigRepositoryOutputPort as LlmRepoPort,
    ChatClientOutputPort,
};
use infra::apikey::{
    SqliteApikeyRepositoryOutputAdapter,
    AesCryptoOutputAdapter,
};
use infra::llm::{
    SqliteLlmConfigOutputAdapter,
    OpenAiHttpChatClientOutputAdapter,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // 1. SQLite 连接
            let app_data_dir = app.path().app_data_dir().unwrap();
            std::fs::create_dir_all(&app_data_dir).unwrap();
            let db_path = app_data_dir.join("easy_agent.db");
            let conn = Arc::new(Connection::open(&db_path).unwrap());

            // 2. 初始化表
            SqliteApikeyRepositoryOutputAdapter::new(conn.clone()).init_table()?;
            SqliteLlmConfigOutputAdapter::new(conn.clone()).init_table()?;

            // 3. 创建 OutputAdapter（实现 OutputPort）
            let crypto = Arc::new(
                AesCryptoOutputAdapter::from_env()
                    .expect("Missing API_KEY_ENCRYPTION_KEY")
            );
            let apikey_repo = Arc::new(SqliteApikeyRepositoryOutputAdapter::new(conn.clone()));
            let llm_repo = Arc::new(SqliteLlmConfigOutputAdapter::new(conn.clone()));
            let chat_client = Arc::new(OpenAiHttpChatClientOutputAdapter::new());

            // 4. 创建 Application（实现 InputPort）
            let apikey_app = Arc::new(ApikeyApplication::new(
                apikey_repo.clone() as Arc<dyn ApikeyRepoPort>,
                crypto.clone() as Arc<dyn CryptoServiceOutputPort>,
            ));

            let llm_app = Arc::new(LlmApplication::new(
                llm_repo.clone() as Arc<dyn LlmRepoPort>,
                apikey_repo.clone() as Arc<dyn ApikeyRepoPort>,
                crypto.clone() as Arc<dyn CryptoServiceOutputPort>,
                chat_client.clone() as Arc<dyn ChatClientOutputPort>,
            ));

            // 5. 注册到 Tauri state
            app.manage(apikey_app as Arc<dyn ApikeyInputPort>);
            app.manage(llm_app as Arc<dyn LlmInputPort>);

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            infra::apikey::apikey_create,
            infra::apikey::apikey_list,
            infra::apikey::apikey_get,
            infra::apikey::apikey_update,
            infra::apikey::apikey_delete,
            infra::apikey::apikey_verify,
            infra::llm::llm_create_config,
            infra::llm::llm_list_configs,
            infra::llm::llm_chat,
            infra::llm::llm_delete_config,
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
│  │  LlmInputAdapter    │       │  LlmOutputAdapter        │  │
│  │  (实现 InputPort)   │       │  (实现 OutputPort)       │  │
│  │  Tauri Commands     │       │  SQLite + HTTP Client   │  │
│  │  Agent/Graph 接口   │       │                         │  │
│  └──────────┬──────────┘       └───────────┬─────────────┘  │
└─────────────┼─────────────────────────────┼─────────────────┘
              │                             │
              ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Application（应用层）                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            LlmApplication                            │  │
│  │  实现 LlmInputPort  │  编排 OutputPort（依赖倒置注入） │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Domain（领域层）                                 │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │   LlmEntity  │  │  LlmInputPort │  │ LlmOutputPort │   │
│  │   （实体）   │  │（接口，外部调）│  │（接口，外部依）│   │
│  └──────────────┘  └───────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 依赖方向

- **LlmApplication** 实现 **LlmInputPort**（被 InputAdapter 调用）
- **LlmApplication** 依赖 **LlmOutputPort**（由 OutputAdapter 注入）
- **LlmEntity** 纯净无外部依赖
- **LlmInputAdapter** 调用 **LlmInputPort**（Tauri/Agent/Graph → 核心）
- **LlmOutputAdapter** 实现 **LlmOutputPort**（外部 → 核心）

### 与 ApiKey 模块的关系

```
LlmApplication
    │
    ├── 依赖 ApikeyRepositoryOutputPort（复用 ApiKey 的持久化）
    └── 依赖 CryptoServiceOutputPort（解密 API Key）
```

ApiKey 的 OutputAdapter 同时被 ApiKey Application 和 LlmApplication 共同使用，这是 OutputPort 复用的典型场景。
