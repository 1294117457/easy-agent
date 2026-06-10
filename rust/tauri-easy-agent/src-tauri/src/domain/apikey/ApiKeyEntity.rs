use chrono::{DateTime,Utc};
use serde::{Deserialize,Serialize};
use uuid::Uuid;
/**派生宏、为类型实现指定trait
    Debug：允许用 {:?} 格式化打印，便于调试
    Clone：允许显式调用 .clone() 复制实例
    Deserialize：允许从 JSON/TOML 等格式反序列化
    Serialize：允许序列化为 JSON/TOML 
    PartialEq：允许使用 == 比较两个实例
*/
#[derive(Debug Clone Deserialize Serialize PartialEq)]
pub struct ApiKeyId(pub String);

impl ApiKeyId{
    pub fn new()->Self{
        Self(Uuid::new_v4().to_string())
    }

    pub fn from_string(s:String)->Self{
        Self(s)
    }

    pub fn as_str(&self)->&str{
        &self.0
    }
}

impl Default for ApiKeyId{
    fn default()->Self{
        Self::new()
    }
}

#[derive(Debug Clone Deserialize Serialize PartialEq)]
pub enum KeyStatus{
    Active,
    Inactive,
    Expired,
}
//聚合根Apikey实体，聚合ApikeyId、KeyStatus
pub struct ApiKey{
    pub id:ApiKeyId,
    pub name:String,
    pub encrypted_key:String,
    pub base_url:Option<String>,
    pub status:KeyStatus,
    pub created_at:DateTime<Utc>,
    pub updated_at:DateTime<Utc>,
    pub last_used_at:Option<DateTime<Utc>>,
}

impl ApiKey{
    pub fn new(name:String,encrypted_key:String,base_url:Option<String>)->Self{
        Self{
            id:ApiKeyId::new(),
            name,
            encrypted_key,
            base_url,
            status:KeyStatus::Active,
            created_at:Utc::now(),
            updated_at:Utc::now(),
            last_used_at:None,
        }
    }
        pub fn reconstitute(id:ApiKeyId,name:String,encrypted_key:String,base_url:Option<String>,status:KeyStatus,created_at:DateTime<Utc>,updated_at:DateTime<Utc>,last_used_at:Option<DateTime<Utc>>)->Self{
            Self{
                id,
                name,
                encrypted_key,
                base_url,
                status,
                created_at,
                updated_at,
                last_used_at,
            }
        }
        /**
        状态检测、修改更新key，更新url、记录使用时间
        */
        pub fn is_active(&self)->bool{
            self.status == KeyStatus::Active
        }
        pub fn activate(&mut self){
            self.status=KeyStatus::Active;
            self.updated_at=Utc::now();
        }
        pub fn deactivate(&mut self){
            self.status=KeyStatus::Inactive;
            self.updated_at=Utc::now();
        }
        pub fn mark_expired(&mut self){
            self.status=KeyStatus::Expired;
            self.updated_at=Utc::now();
        }
        pub fn update_key(&mut self,encrypted_key:String){
            self.encrypted_key=encrypted_key;
            self.updated_at=Utc::now();
        }
        pub fn set_base_url(&mut self,_url:Option<String>){
            self.base_url=_url;
            self.updated_at=Utc::now();
        }
        pub fn record_usage(&mut self){
            if !self.is_active(){
                return Err("Cannot record usage for inactive key".to_string());
            }
            self.last_used_at=Some(Utc::now());
            self.updated_at=Utc::now();
        }
}

