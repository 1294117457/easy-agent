use crate::domain::apikey::ApikeyEntity::{ApiKey,ApiKeyId,KeyStatus};
use std::sync::Sync;

pub trait ApiKeyInputPort:Send+Sync{
    async fn create(
        &self,
        name:String,
        api_key:String,
        base_url:Option<String>,
    )->Result<ApiKey,ApiKeyInputError>;

    async fn get_by_id(&self,id:&str)->Result<Option<ApiKey>,ApiKeyInputError>;

    async fn list_all(&self)->Result<Vec<ApiKey>,ApiKeyInputError>;

    async fn get_default(&self) -> Result<Option<ApiKey>, ApiKeyInputError>;

    async fn update(&self,id:&str,api_key:String,base_url:Option<String>,status:KeyStatus)
        ->Result<ApiKey,ApiKeyInputError>;

    async fn verify(&self,id:&str)->Result<(),ApiKeyInputError>;

    async fn record_usage(&self,id:&str)->Result<(),ApiKeyInputError>;
    
}

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