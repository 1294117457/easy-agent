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

        self.repository
            .save(&apikey)
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
        self.repository
            .find_all()
            .await
            .map_err(Self::map_repo_error)
    }

    async fn get_default(&self) -> Result<Option<ApiKey>, ApikeyInputError> {
        self.repository
            .find_default()
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

        self.repository
            .save(&apikey)
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

        self.crypto
            .verify(&apikey)
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
        self.repository
            .save(&apikey)
            .await
            .map_err(Self::map_repo_error)
    }
}
uct ApiKetId(pub String);
