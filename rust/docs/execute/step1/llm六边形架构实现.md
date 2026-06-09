# LLM 六边形架构实现

## 1. 目录结构

```
step1/
├── llm/
│   ├── mod.rs                    # 模块入口
│   ├── entity.rs                 # 实体定义
│   ├── port/
│   │   ├── mod.rs
│   │   ├── repository.rs         # 仓储端口（LLM 配置持久化）
│   │   ├── chat_client.rs        # 聊天客户端端口
│   │   └── service.rs            # LLM 管理服务端口
│   ├── adapter/
│   │   ├── mod.rs
│   │   ├── persistence/
│   │   │   ├── mod.rs
│   │   │   └── sqlite.rs         # SQLite 持久化适配器
│   │   └── http/
│   │       ├── mod.rs
│   │       └── openai_client.rs  # OpenAI 兼容接口的 HTTP Client
│   └── application/
│       ├── mod.rs
│       ├── llm_service.rs         # 应用服务实现
│       └── dto.rs                # 数据传输对象
```

## 2. Entity（实体）

```rust
// src-tauri/src/domain/llm/entity.rs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::apikey::entity::{ApiKeyId, LlmProvider};

// ==================== 包装类型 ====================

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

// ==================== 配置参数值对象 ====================

/// LLM 采样参数
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

// ==================== 消息类型 ====================

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

/// LLM 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletion {
    pub model: String,
    pub content: String,
    pub usage: Usage,
    pub finish_reason: String,
    pub tool_calls: Option<Vec<ToolCall>>,
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

// ==================== LLM 配置实体 ====================

/// LLM 配置实体
///
/// 代表一个 LLM 实例的配置，包含关联的 ApiKey 和采样参数。
/// 一个 ApiKey 可以对应多个 LLM 配置（不同模型）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    /// 唯一标识符
    pub id: LlmConfigId,
    /// 名称（用户自定义）
    pub name: String,
    /// 关联的 ApiKey ID
    pub api_key_id: ApiKeyId,
    /// LLM 提供商
    pub provider: LlmProvider,
    /// 模型名称（如 gpt-4o、claude-sonnet-4-20250514、qwen-turbo）
    pub model: String,
    /// 自定义 API 地址（覆盖 ApiKey 的 base_url）
    pub base_url: Option<String>,
    /// 采样参数
    pub sampling_params: LlmSamplingParams,
    /// 是否为默认配置
    pub is_default: bool,
    /// 是否启用
    pub is_active: bool,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

impl LlmConfig {
    // ============ 构造函数 ============

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

    /// 从持久化数据重建
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
        Self {
            id,
            name,
            api_key_id,
            provider,
            model,
            base_url,
            sampling_params,
            is_default,
            is_active,
            created_at,
            updated_at,
        }
    }

    // ============ 业务方法 ============

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

    pub fn unset_default(&mut self) {
        self.is_default = false;
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

## 3. Port（端口）

### 3.1 仓储端口（repository.rs）

```rust
// src-tauri/src/domain/llm/port/repository.rs

use crate::domain::llm::entity::{LlmConfig, LlmConfigId, LlmProvider};

/// LLM 配置仓储端口
pub trait LlmConfigRepository: Send + Sync {
    fn find_by_id(&self, id: &LlmConfigId) -> impl Future<Output = Result<Option<LlmConfig>, RepoError>> + Send;

    fn find_all(&self) -> impl Future<Output = Result<Vec<LlmConfig>, RepoError>> + Send;

    fn find_by_provider(&self, provider: LlmProvider) -> impl Future<Output = Result<Vec<LlmConfig>, RepoError>> + Send;

    fn find_by_api_key(&self, api_key_id: &str) -> impl Future<Output = Result<Vec<LlmConfig>, RepoError>> + Send;

    fn save(&self, config: &LlmConfig) -> impl Future<Output = Result<(), RepoError>> + Send;

    fn delete(&self, id: &LlmConfigId) -> impl Future<Output = Result<(), RepoError>> + Send;

    fn find_default(&self) -> impl Future<Output = Result<Option<LlmConfig>, RepoError>> + Send;

    /// 将其他配置设为非默认（原子操作的一部分）
    fn unset_all_default(&self) -> impl Future<Output = Result<(), RepoError>> + Send;
}

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

### 3.2 聊天客户端端口（chat_client.rs）

```rust
// src-tauri/src/domain/llm/port/chat_client.rs

use crate::domain::llm::entity::{ChatCompletion, Message, ToolCall};

/// 聊天客户端端口（核心 driving port）
///
/// 定义与 LLM Provider 通信的能力契约。
/// 不同 Provider（OpenAI / Anthropic / Qwen）共用同一个接口，
/// 由 adapter 层的具体 Client 实现。
pub trait ChatClient: Send + Sync {
    /// 发送聊天请求
    async fn chat(
        &self,
        messages: Vec<Message>,
        model: &str,
        temperature: f32,
        top_p: f32,
        max_tokens: u32,
        stop: Option<Vec<String>>,
    ) -> Result<ChatCompletion, ChatError>;

    /// 发送带工具调用的聊天请求
    async fn chat_with_tools(
        &self,
        messages: Vec<Message>,
        model: &str,
        temperature: f32,
        top_p: f32,
        max_tokens: u32,
        tools: Vec<ToolDefinition>,
    ) -> Result<ChatCompletion, ChatError>;

    /// 获取模型列表
    async fn list_models(&self, base_url: &str, api_key: &str) -> Result<Vec<ModelInfo>, ChatError>;
}

/// 工具定义（用于 function calling / tool use）
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value, // JSON Schema
}

/// 模型信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub owned_by: String,
}

#[derive(Debug, thiserror::Error)]
pub enum ChatError {
    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Authentication failed: {0}")]
    AuthError(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Model error: {0}")]
    ModelError(String),

    #[error("Context length exceeded")]
    ContextLengthExceeded,

    #[error("Unknown error: {0}")]
    Unknown(String),
}
```

### 3.3 LLM 服务端口（service.rs）

```rust
// src-tauri/src/domain/llm/port/service.rs

use crate::domain::llm::entity::{ChatCompletion, LlmConfig, Message, ToolCall};

/// LLM 管理服务端口
///
/// 定义 LLM 的高级业务能力契约，由 Application 层使用。
pub trait LlmService: Send + Sync {
    /// 根据配置执行聊天
    async fn chat(
        &self,
        config_id: &str,
        messages: Vec<Message>,
    ) -> Result<ChatCompletion, LlmServiceError>;

    /// 根据配置执行带工具调用的聊天
    async fn chat_with_tools(
        &self,
        config_id: &str,
        messages: Vec<Message>,
        tools: Vec<crate::domain::llm::port::chat_client::ToolDefinition>,
    ) -> Result<ChatCompletion, LlmServiceError>;

    /// 根据 Provider 执行聊天（使用默认配置）
    async fn chat_with_provider(
        &self,
        provider: crate::domain::apikey::entity::LlmProvider,
        messages: Vec<Message>,
    ) -> Result<ChatCompletion, LlmServiceError>;
}

#[derive(Debug, thiserror::Error)]
pub enum LlmServiceError {
    #[error("Chat error: {0}")]
    ChatError(#[from] crate::domain::llm::port::chat_client::ChatError),

    #[error("Repository error: {0}")]
    RepoError(#[from] crate::domain::llm::port::repository::RepoError),

    #[error("Crypto error: {0}")]
    CryptoError(String),

    #[error("LLM config not found: {0}")]
    ConfigNotFound(String),

    #[error("ApiKey not found or inactive: {0}")]
    ApiKeyNotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),
}
```

## 4. Adapter（适配器）

### 4.1 持久化适配器（sqlite.rs）

```rust
// src-tauri/src/domain/llm/adapter/persistence/sqlite.rs

use async_trait::async_trait;
use rusqlite::{params, Connection};

use crate::domain::apikey::entity::LlmProvider;
use crate::domain::llm::entity::{LlmConfig, LlmConfigId, LlmSamplingParams};
use crate::domain::llm::port::repository::{LlmConfigRepository, RepoError};

pub struct SqliteLlmConfigRepository {
    conn: Connection,
}

impl SqliteLlmConfigRepository {
    pub fn new(conn: Connection) -> Self {
        Self { conn }
    }

    pub fn init_table(&self) -> Result<(), RepoError> {
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
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    fn map_row(row: &rusqlite::Row) -> Result<LlmConfig, rusqlite::Error> {
        let params_str: String = row.column(7)?;
        let sampling_params: LlmSamplingParams = serde_json::from_str(&params_str)
            .unwrap_or_default();

        Ok(LlmConfig {
            id: LlmConfigId(row.column::<String>(0)?),
            name: row.column::<String>(1)?,
            api_key_id: crate::domain::apikey::entity::ApiKeyId(row.column::<String>(2)?),
            provider: serde_json::from_str(&row.column::<String>(3)?)
                .unwrap_or(LlmProvider::OpenAi),
            model: row.column::<String>(4)?,
            base_url: row.column::<Option<String>>(5)?,
            sampling_params,
            is_default: row.column::<i32>(6)? != 0,
            is_active: row.column::<i32>(7)? != 0,
            created_at: row.column::<String>(8)?.parse().unwrap_or_default(),
            updated_at: row.column::<String>(9)?.parse().unwrap_or_default(),
        })
    }
}

#[async_trait]
impl LlmConfigRepository for SqliteLlmConfigRepository {
    async fn find_by_id(&self, id: &LlmConfigId) -> Result<Option<LlmConfig>, RepoError> {
        let mut stmt = self.conn.prepare(
            "SELECT id,name,api_key_id,provider,model,base_url,sampling_params,is_default,is_active,created_at,updated_at FROM llm_configs WHERE id = ?"
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        let result = stmt
            .query_row([id.as_str()], Self::map_row)
            .optional()
            .map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        Ok(result)
    }

    async fn find_all(&self) -> Result<Vec<LlmConfig>, RepoError> {
        let mut stmt = self.conn.prepare(
            "SELECT id,name,api_key_id,provider,model,base_url,sampling_params,is_default,is_active,created_at,updated_at FROM llm_configs ORDER BY created_at DESC"
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        let rows = stmt.query_map([], Self::map_row)
            .map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        let mut configs = Vec::new();
        for row in rows {
            configs.push(row.map_err(|e| RepoError::DatabaseError(e.to_string()))?);
        }
        Ok(configs)
    }

    async fn find_by_provider(&self, provider: LlmProvider) -> Result<Vec<LlmConfig>, RepoError> {
        let provider_str = serde_json::to_string(&provider).unwrap();
        let mut stmt = self.conn.prepare(
            "SELECT ... FROM llm_configs WHERE provider = ?"
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        let rows = stmt.query_map([provider_str.as_str()], Self::map_row)
            .map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        let mut configs = Vec::new();
        for row in rows {
            configs.push(row.map_err(|e| RepoError::DatabaseError(e.to_string()))?);
        }
        Ok(configs)
    }

    async fn find_by_api_key(&self, api_key_id: &str) -> Result<Vec<LlmConfig>, RepoError> {
        let mut stmt = self.conn.prepare(
            "SELECT ... FROM llm_configs WHERE api_key_id = ?"
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        let rows = stmt.query_map([api_key_id], Self::map_row)
            .map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        let mut configs = Vec::new();
        for row in rows {
            configs.push(row.map_err(|e| RepoError::DatabaseError(e.to_string()))?);
        }
        Ok(configs)
    }

    async fn save(&self, config: &LlmConfig) -> Result<(), RepoError> {
        let provider_str = serde_json::to_string(&config.provider).unwrap();
        let params_str = serde_json::to_string(&config.sampling_params).unwrap();

        self.conn.execute(
            r#"
            INSERT INTO llm_configs (id,name,api_key_id,provider,model,base_url,sampling_params,is_default,is_active,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                api_key_id=excluded.api_key_id,
                provider=excluded.provider,
                model=excluded.model,
                base_url=excluded.base_url,
                sampling_params=excluded.sampling_params,
                is_default=excluded.is_default,
                is_active=excluded.is_active,
                updated_at=excluded.updated_at
            "#,
            params![
                config.id.as_str(),
                config.name,
                config.api_key_id.as_str(),
                provider_str,
                config.model,
                config.base_url,
                params_str,
                config.is_default as i32,
                config.is_active as i32,
                config.created_at.to_rfc3339(),
                config.updated_at.to_rfc3339(),
            ],
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn delete(&self, id: &LlmConfigId) -> Result<(), RepoError> {
        self.conn.execute(
            "DELETE FROM llm_configs WHERE id = ?",
            [id.as_str()],
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    async fn find_default(&self) -> Result<Option<LlmConfig>, RepoError> {
        let mut stmt = self.conn.prepare(
            "SELECT ... FROM llm_configs WHERE is_default = 1 AND is_active = 1 LIMIT 1"
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        let result = stmt
            .query_row([], Self::map_row)
            .optional()
            .map_err(|e| RepoError::DatabaseError(e.to_string()))?;

        Ok(result)
    }

    async fn unset_all_default(&self) -> Result<(), RepoError> {
        self.conn.execute(
            "UPDATE llm_configs SET is_default = 0",
            [],
        ).map_err(|e| RepoError::DatabaseError(e.to_string()))?;
        Ok(())
    }
}
```

### 4.2 HTTP 客户端适配器（openai_client.rs）

```rust
// src-tauri/src/domain/llm/adapter/http/openai_client.rs

use reqwest::{Client, header};
use std::time::Duration;

use crate::domain::llm::entity::{ChatCompletion, Message, ToolCall, Usage};
use crate::domain::llm::port::chat_client::{
    ChatClient, ChatError, ModelInfo, ToolDefinition,
};

/// OpenAI 兼容接口的 HTTP Chat Client
///
/// 支持 OpenAI、Qwen、Groq、DeepSeek 等所有兼容 OpenAI API 格式的 Provider。
pub struct OpenAiChatClient {
    client: Client,
}

impl OpenAiChatClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .default_header(header::CONTENT_TYPE, "application/json")
            .build()
            .expect("Failed to create HTTP client");

        Self { client }
    }

    fn build_url(base_url: &str, path: &str) -> String {
        let base = base_url.trim_end_matches('/');
        format!("{}{}", base, path)
    }

    fn map_error(status: u16, body: &str) -> ChatError {
        match status {
            401 | 403 => ChatError::AuthError(body.to_string()),
            429 => ChatError::RateLimitExceeded,
            400 => ChatError::InvalidRequest(body.to_string()),
            _ => ChatError::Unknown(body.to_string()),
        }
    }
}

impl ChatClient for OpenAiChatClient {
    async fn chat(
        &self,
        messages: Vec<Message>,
        model: &str,
        temperature: f32,
        top_p: f32,
        max_tokens: u32,
        stop: Option<Vec<String>>,
    ) -> Result<ChatCompletion, ChatError> {
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

        let response = self.client
            .post("https://api.openai.com/v1/chat/completions")
            .json(&body)
            .send()
            .await
            .map_err(|e| ChatError::NetworkError(e.to_string()))?;

        let status = response.status().as_u16();
        let body_text = response.text().await.unwrap_or_default();

        if status != 200 {
            return Err(Self::map_error(status, &body_text));
        }

        let json: serde_json::Value = serde_json::from_str(&body_text)
            .map_err(|e| ChatError::InvalidRequest(e.to_string()))?;

        let choices = json["choices"].as_array()
            .ok_or_else(|| ChatError::InvalidRequest("No choices in response".into()))?;

        let choice = choices.first()
            .ok_or_else(|| ChatError::InvalidRequest("Empty choices".into()))?;

        let content = choice["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let finish_reason = choice["finish_reason"]
            .as_str()
            .unwrap_or("stop")
            .to_string();

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

    async fn chat_with_tools(
        &self,
        messages: Vec<Message>,
        model: &str,
        temperature: f32,
        top_p: f32,
        max_tokens: u32,
        tools: Vec<ToolDefinition>,
    ) -> Result<ChatCompletion, ChatError> {
        let mut body = serde_json::json!({
            "model": model,
            "messages": messages.iter().map(|m| m.to_openai_format()).collect::<Vec<_>>(),
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
            "tools": tools,
        });

        let response = self.client
            .post("https://api.openai.com/v1/chat/completions")
            .json(&body)
            .send()
            .await
            .map_err(|e| ChatError::NetworkError(e.to_string()))?;

        let status = response.status().as_u16();
        let body_text = response.text().await.unwrap_or_default();

        if status != 200 {
            return Err(Self::map_error(status, &body_text));
        }

        let json: serde_json::Value = serde_json::from_str(&body_text)
            .map_err(|e| ChatError::InvalidRequest(e.to_string()))?;

        // ... 解析逻辑同上
        todo!("Parse tool calls from response")
    }

    async fn list_models(&self, base_url: &str, api_key: &str) -> Result<Vec<ModelInfo>, ChatError> {
        let url = Self::build_url(base_url, "/v1/models");

        let response = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
            .map_err(|e| ChatError::NetworkError(e.to_string()))?;

        let status = response.status().as_u16();
        let body_text = response.text().await.unwrap_or_default();

        if status != 200 {
            return Err(Self::map_error(status, &body_text));
        }

        let json: serde_json::Value = serde_json::from_str(&body_text)
            .map_err(|e| ChatError::InvalidRequest(e.to_string()))?;

        let models = json["data"].as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| {
                        Some(ModelInfo {
                            id: m["id"].as_str()?.to_string(),
                            object: m["object"].as_str().unwrap_or("model").to_string(),
                            created: m["created"].as_u64().unwrap_or(0),
                            owned_by: m["owned_by"].as_str().unwrap_or("").to_string(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(models)
    }
}
```

## 5. Application（应用层）

### 5.1 DTO（dto.rs）

```rust
// src-tauri/src/domain/llm/application/dto.rs

use serde::{Deserialize, Serialize};
use crate::domain::apikey::entity::LlmProvider;
use crate::domain::llm::entity::{LlmConfigId, LlmSamplingParams, Message, MessageRole, ChatCompletion};

/// 创建 LLM 配置的请求 DTO
#[derive(Debug, Deserialize)]
pub struct CreateLlmConfigDto {
    pub name: String,
    pub api_key_id: String,
    pub provider: LlmProvider,
    pub model: String,
    pub base_url: Option<String>,
    pub sampling_params: Option<LlmSamplingParams>,
}

/// 更新 LLM 配置的请求 DTO
#[derive(Debug, Deserialize)]
pub struct UpdateLlmConfigDto {
    pub name: Option<String>,
    pub model: Option<String>,
    pub base_url: Option<String>,
    pub sampling_params: Option<LlmSamplingParams>,
    pub is_default: Option<bool>,
    pub is_active: Option<bool>,
}

/// LLM 配置响应 DTO
#[derive(Debug, Serialize)]
pub struct LlmConfigResponseDto {
    pub id: String,
    pub name: String,
    pub api_key_id: String,
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
    pub sampling_params: LlmSamplingParams,
    pub is_default: bool,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&LlmConfig> for LlmConfigResponseDto {
    fn from(config: &LlmConfig) -> Self {
        Self {
            id: config.id.as_str().to_string(),
            name: config.name.clone(),
            api_key_id: config.api_key_id.as_str().to_string(),
            provider: config.provider.as_str().to_string(),
            model: config.model.clone(),
            base_url: config.base_url.clone(),
            sampling_params: config.sampling_params.clone(),
            is_default: config.is_default,
            is_active: config.is_active,
            created_at: config.created_at.to_rfc3339(),
            updated_at: config.updated_at.to_rfc3339(),
        }
    }
}

/// 聊天请求 DTO
#[derive(Debug, Deserialize)]
pub struct ChatRequestDto {
    pub llm_config_id: Option<String>,    // 优先用配置 ID
    pub provider: Option<LlmProvider>,   // 其次用 Provider（用默认配置）
    pub messages: Vec<MessageDto>,
}

#[derive(Debug, Deserialize)]
pub struct MessageDto {
    pub role: String,
    pub content: String,
}

impl From<&MessageDto> for Message {
    fn from(dto: &MessageDto) -> Self {
        let role = match dto.role.as_str() {
            "system" => MessageRole::System,
            "user" => MessageRole::User,
            "assistant" => MessageRole::Assistant,
            "tool" => MessageRole::Tool,
            _ => MessageRole::User,
        };
        Message { role, content: dto.content.clone(), tool_call_id: None, name: None }
    }
}

/// 聊天响应 DTO
#[derive(Debug, Serialize)]
pub struct ChatResponseDto {
    pub model: String,
    pub content: String,
    pub finish_reason: String,
    pub tool_calls: Option<Vec<ToolCallDto>>,
    pub usage: UsageDto,
}

#[derive(Debug, Serialize)]
pub struct ToolCallDto {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Serialize)]
pub struct UsageDto {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

impl From<ChatCompletion> for ChatResponseDto {
    fn from(completion: ChatCompletion) -> Self {
        Self {
            model: completion.model,
            content: completion.content,
            finish_reason: completion.finish_reason,
            tool_calls: completion.tool_calls.map(|tcs| {
                tcs.iter().map(|tc| ToolCallDto {
                    id: tc.id.clone(),
                    name: tc.name.clone(),
                    arguments: tc.arguments.clone(),
                }).collect()
            }),
            usage: UsageDto {
                prompt_tokens: completion.usage.prompt_tokens,
                completion_tokens: completion.usage.completion_tokens,
                total_tokens: completion.usage.total_tokens,
            },
        }
    }
}
```

### 5.2 应用服务（llm_service.rs）

```rust
// src-tauri/src/domain/llm/application/llm_service.rs

use std::sync::Arc;
use thiserror::Error;

use crate::domain::apikey::entity::{ApiKeyId, LlmProvider};
use crate::domain::apikey::port::repository::ApiKeyRepository;
use crate::domain::apikey::port::service::CryptoService;
use crate::domain::llm::entity::{ChatCompletion, LlmConfig, LlmConfigId, Message};
use crate::domain::llm::port::chat_client::{ChatClient, ToolDefinition};
use crate::domain::llm::port::repository::{LlmConfigRepository, RepoError};
use crate::domain::llm::application::dto::{
    ChatRequestDto, ChatResponseDto, CreateLlmConfigDto, LlmConfigResponseDto, UpdateLlmConfigDto,
};

pub struct LlmService {
    llm_repo: Arc<dyn LlmConfigRepository>,
    apikey_repo: Arc<dyn ApiKeyRepository>,
    crypto: Arc<dyn CryptoService>,
    chat_client: Arc<dyn ChatClient>,
}

#[derive(Debug, Error)]
pub enum LlmServiceError {
    #[error("Repository error: {0}")]
    RepoError(#[from] RepoError),

    #[error("Chat error: {0}")]
    ChatError(String),

    #[error("Crypto error: {0}")]
    CryptoError(String),

    #[error("LLM config not found: {0}")]
    ConfigNotFound(String),

    #[error("ApiKey not found or inactive: {0}")]
    ApiKeyNotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

impl LlmService {
    pub fn new(
        llm_repo: Arc<dyn LlmConfigRepository>,
        apikey_repo: Arc<dyn ApiKeyRepository>,
        crypto: Arc<dyn CryptoService>,
        chat_client: Arc<dyn ChatClient>,
    ) -> Self {
        Self { llm_repo, apikey_repo, crypto, chat_client }
    }

    // ==================== 配置管理 ====================

    pub async fn create_config(&self, dto: CreateLlmConfigDto) -> Result<LlmConfigResponseDto, LlmServiceError> {
        // 验证关联的 ApiKey 存在
        self.apikey_repo
            .find_by_id(&ApiKeyId::from_string(dto.api_key_id.clone()))
            .await?
            .ok_or_else(|| LlmServiceError::ApiKeyNotFound(dto.api_key_id.clone()))?;

        let mut config = LlmConfig::new(
            dto.name,
            ApiKeyId::from_string(dto.api_key_id),
            dto.provider,
            dto.model,
        );
        config.set_base_url(dto.base_url);

        if let Some(params) = dto.sampling_params {
            config.update_sampling_params(params);
        }

        self.llm_repo.save(&config).await?;
        Ok(LlmConfigResponseDto::from(&config))
    }

    pub async fn update_config(&self, id: &str, dto: UpdateLlmConfigDto) -> Result<LlmConfigResponseDto, LlmServiceError> {
        let mut config = self.llm_repo
            .find_by_id(&LlmConfigId::from_string(id.to_string()))
            .await?
            .ok_or_else(|| LlmServiceError::ConfigNotFound(id.to_string()))?;

        if let Some(name) = dto.name {
            config.name = name;
            config.updated_at = chrono::Utc::now();
        }

        if let Some(model) = dto.model {
            config.update_model(model);
        }

        if let Some(base_url) = dto.base_url {
            config.set_base_url(Some(base_url));
        }

        if let Some(params) = dto.sampling_params {
            config.update_sampling_params(params);
        }

        if let Some(is_default) = dto.is_default {
            if is_default {
                self.llm_repo.unset_all_default().await?;
                config.set_as_default();
            }
        }

        if let Some(is_active) = dto.is_active {
            if is_active { config.activate(); } else { config.deactivate(); }
        }

        self.llm_repo.save(&config).await?;
        Ok(LlmConfigResponseDto::from(&config))
    }

    pub async fn get_config(&self, id: &str) -> Result<LlmConfigResponseDto, LlmServiceError> {
        let config = self.llm_repo
            .find_by_id(&LlmConfigId::from_string(id.to_string()))
            .await?
            .ok_or_else(|| LlmServiceError::ConfigNotFound(id.to_string()))?;

        Ok(LlmConfigResponseDto::from(&config))
    }

    pub async fn list_configs(&self) -> Result<Vec<LlmConfigResponseDto>, LlmServiceError> {
        let configs = self.llm_repo.find_all().await?;
        Ok(configs.iter().map(LlmConfigResponseDto::from).collect())
    }

    pub async fn delete_config(&self, id: &str) -> Result<(), LlmServiceError> {
        self.llm_repo
            .delete(&LlmConfigId::from_string(id.to_string()))
            .await?;
        Ok(())
    }

    // ==================== 聊天 ====================

    pub async fn chat(&self, request: ChatRequestDto) -> Result<ChatResponseDto, LlmServiceError> {
        let messages: Vec<Message> = request.messages.iter().map(Message::from).collect();

        let (config, api_key) = self.resolve_config_and_key(&request).await?;

        // 解密 API Key
        let decrypted_key = self.crypto
            .decrypt(&api_key.encrypted_key)
            .map_err(|e| LlmServiceError::CryptoError(e.to_string()))?;

        let base_url = config.base_url.as_deref()
            .or(api_key.base_url.as_deref())
            .unwrap_or("https://api.openai.com");

        let completion = self.chat_with_url(
            &base_url,
            &decrypted_key,
            &config,
            messages,
            None,
        ).await?;

        Ok(ChatResponseDto::from(completion))
    }

    pub async fn chat_with_tools(
        &self,
        request: ChatRequestDto,
        tools: Vec<ToolDefinition>,
    ) -> Result<ChatResponseDto, LlmServiceError> {
        let messages: Vec<Message> = request.messages.iter().map(Message::from).collect();

        let (config, api_key) = self.resolve_config_and_key(&request).await?;

        let decrypted_key = self.crypto
            .decrypt(&api_key.encrypted_key)
            .map_err(|e| LlmServiceError::CryptoError(e.to_string()))?;

        let base_url = config.base_url.as_deref()
            .or(api_key.base_url.as_deref())
            .unwrap_or("https://api.openai.com");

        let completion = self.chat_with_url(
            &base_url,
            &decrypted_key,
            &config,
            messages,
            Some(tools),
        ).await?;

        Ok(ChatResponseDto::from(completion))
    }

    /// 根据请求解析配置和 API Key
    async fn resolve_config_and_key(&self, request: &ChatRequestDto)
        -> Result<(LlmConfig, crate::domain::apikey::entity::ApiKey), LlmServiceError> {

        let config = if let Some(ref config_id) = request.llm_config_id {
            self.llm_repo
                .find_by_id(&LlmConfigId::from_string(config_id.clone()))
                .await?
                .ok_or_else(|| LlmServiceError::ConfigNotFound(config_id.clone()))?
        } else if let Some(provider) = request.provider {
            // 按 Provider 查默认配置
            let configs = self.llm_repo.find_by_provider(provider).await?;
            configs.into_iter()
                .find(|c| c.is_active)
                .ok_or_else(|| LlmServiceError::ConfigNotFound(format!("No active config for provider: {:?}", provider)))?
        } else {
            // 取全局默认配置
            self.llm_repo.find_default().await?
                .ok_or_else(|| LlmServiceError::InvalidInput("No default LLM config".into()))?
        };

        let api_key = self.apikey_repo
            .find_by_id(&config.api_key_id)
            .await?
            .ok_or_else(|| LlmServiceError::ApiKeyNotFound(config.api_key_id.as_str().to_string()))?;

        if !api_key.is_active() {
            return Err(LlmServiceError::ApiKeyNotFound(format!("ApiKey {} is inactive", api_key.id.as_str())));
        }

        Ok((config, api_key))
    }

    async fn chat_with_url(
        &self,
        base_url: &str,
        api_key: &str,
        config: &LlmConfig,
        messages: Vec<Message>,
        tools: Option<Vec<ToolDefinition>>,
    ) -> Result<ChatCompletion, LlmServiceError> {
        let client = OpenAiChatClient::new();

        let completion = if let Some(tools) = tools {
            client.chat_with_tools(
                messages,
                &config.model,
                config.sampling_params.temperature,
                config.sampling_params.top_p,
                config.sampling_params.max_tokens,
                tools,
            ).await
        } else {
            client.chat(
                messages,
                &config.model,
                config.sampling_params.temperature,
                config.sampling_params.top_p,
                config.sampling_params.max_tokens,
                config.sampling_params.stop.clone(),
            ).await
        }.map_err(|e| LlmServiceError::ChatError(e.to_string()))?;

        Ok(completion)
    }
}
```

### 5.3 模块入口（mod.rs）

```rust
// src-tauri/src/domain/llm/mod.rs

pub mod entity;
pub mod port;
pub mod adapter;
pub mod application;

pub use entity::{LlmConfig, LlmConfigId, LlmSamplingParams, Message, MessageRole, ChatCompletion, ToolCall, Usage};
pub use port::repository::LlmConfigRepository;
pub use port::chat_client::{ChatClient, ChatError, ToolDefinition, ModelInfo};
pub use port::service::{LlmService, LlmServiceError};
pub use application::dto::{
    CreateLlmConfigDto, UpdateLlmConfigDto, LlmConfigResponseDto,
    ChatRequestDto, ChatResponseDto, MessageDto, ToolCallDto, UsageDto,
};
```

## 6. 六边形架构全貌

```
                        ┌─────────────────────────────────────────────┐
                        │              Driving Adapter                  │
                        │  (Tauri Commands / Agent 调用 / Graph 调度)  │
                        └────────────────────┬────────────────────────┘
                                             │
                                             ▼
                        ┌─────────────────────────────────────────────┐
                        │              Application                     │
                        │          LlmService                         │
                        │  • 配置管理  • 消息转换  • Client 编排         │
                        └────────────────────┬────────────────────────┘
                                             │
                         ┌───────────────────┴───────────────────┐
                         │           Port（端口）                    │
                         │  LlmConfigRepository  ChatClient          │
                         └───────────────────┬──────────────────────┘
                                             │
                        ┌────────────────────┴────────────────────┐
                        │             Adapter（适配器）              │
                        │  SqliteLlmConfigRepo  OpenAiChatClient   │
                        │  (还依赖 ApiKey 的 SqliteRepo + Crypto)   │
                        └────────────────────┬────────────────────┘
                                             │
                        ┌────────────────────┴────────────────────┐
                        │           Driven Adapter                   │
                        │  (SQLite Database / OpenAI HTTP API)       │
                        └───────────────────────────────────────────┘
```

### 依赖方向（依赖倒置）

```
Domain Core（entity）
    ↑
Application 依赖 Port（接口）
    ↑
Adapter 实现 Port，注入到 Application
    ↑
Driven Adapter（SQLite、HTTP）
```

- **Application** 只依赖 `LlmConfigRepository` + `ChatClient` 接口
- **Adapter 层** 实现这两个接口，具体实现可替换（换 Provider 只需注入不同的 `ChatClient`）
- **Entity** 完全独立，不引入任何外部依赖
