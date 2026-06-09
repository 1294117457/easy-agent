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