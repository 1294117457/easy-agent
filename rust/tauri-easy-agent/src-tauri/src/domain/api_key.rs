use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ApiKeyId(pub String);
impl ApiKeyId {
    pub fn new() -> Self {
        Self(Uuid::new_v4().to_string())
    }
}
impl Default for ApiKeyId {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LlmProvider {
    OpenAi,
    Anthropic,
    Local,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum KeyStatus {
    Active,
    Inactive,
    Expired,
}

// ==================== 实体 ====================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKey {
    pub id: ApiKeyId,
    pub name: String,
    pub key: String,
    pub provider: LlmProvider,
    pub status: KeyStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}
impl ApiKey {
    pub fn new(name: String, raw_key: String, provider: LlmProvider) -> Self {
        Self {
            id: ApiKeyId::new(),
            name,
            key: raw_key,
            provider,
            status: KeyStatus::Active,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            last_used_at: None,
        }
    }
    pub fn is_active(&self) -> bool {
        self.status == KeyStatus::Active
    }
}