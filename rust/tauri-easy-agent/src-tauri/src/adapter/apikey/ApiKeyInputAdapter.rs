
impl ApiKetInputTrait for ApiKeyInputImpl{
  async fn create(
    &self,
    name:String,
    api_key:String,
    base_url:Option<String>,
  )->Result<ApiKey,ApiKeyInputError>{
    let api_key = ApiKey::new(name,api_key,base_url);
    let api_key = self.repository.create(api_key).await?;
    Ok(api_key)
  }
  async fn get_by_id(
    &self,
    id:String,
  )->Result<ApiKey,ApiKeyInputError>{
    let api_key = self.repository.get_by_id(id).await?;
    Ok(api_key)
  }
}