use crate::domian::apikey::ApikeyEntity::{ApiKey,ApiKeyId,KeyStatus};
use async_trait::async_trait;
#[async_trait]
pub trait ApiKeyOutputPort:Send+Sync{
    async fn find_by_id(&self, id: &ApiKeyId) 
        -> Result<Option<ApiKey>, ApiKeyRepoError>;

    async fn find_all(&self)->Result<Vec<ApiKey>,ApiKeyRepoError>;

    async fn fin_by_status(&self,status:KeyStatus)
        ->Result<Vec<ApiKey>,ApiKeyRepoError>;

    async fn find_default(&self)->Result<Option<ApiKey>,ApiKeyRepoError>;
    

    async fn save(&self,api_key:ApiKey)->Result<ApiKey,ApiKeyRepoError>;

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