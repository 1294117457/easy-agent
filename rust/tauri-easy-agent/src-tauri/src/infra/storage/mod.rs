pub mod sqlite;

use super::domain::api_key::ApiKey;

#[derive(Debug)]
pub enum StorageError {
    ConnectionFailed(String),
    QueryFailed(String),
    NotFound,
}

impl std::error::Error for StorageError {}

// 依赖倒置：domain 层定义接口，infra 层实现
pub trait StoragePort {
    fn init(&self) -> Result<(), StorageError>;

    fn save_api_key(&self, api_key: &ApiKey)
        -> Result<(), StorageError>;

    fn get_api_key(&self, id: &str) -> Result<Option<ApiKey>, StorageError>;

    fn list_api_keys(&self) -> Result<Vec<ApiKey>, StorageError>;
}