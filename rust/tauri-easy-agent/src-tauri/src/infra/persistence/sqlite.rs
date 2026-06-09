/**
引入要用的包，定义struct
实现对应new方法，考虑不同数据库，不将new放入trai
实现StoragePort的trait，实现其方法
*/

use rusqlite::{Connection,params};
use super::{StoragePort,StorageError};
use crate::domain::api_key::ApiKey;

//定义sqlite存储适配器，内部有conn字段
pub struct SqliteStorageAdapter{
    connection:Connection,
}
/**
    Self就是SqliteStorageAdapter的简写
    先在这作为了Result声明的返回类型
    然后再内部Ok{}这里表面返回的是写的conn的外部的这个SqliteStorageAdapter对吗
    这个conn就是存储适配器的conn字段
*/
/**
这没有用&self或&mut self，是静态方法
可以通过SqliteStorageAdapter::new()来调用
实例方法只能通过adaper.create()来调用
*/
/**
|e|是一个匿名函数，然后表示抛出e.to_string(),
同时又用StorageError::ConnectionFailed接收了

最后就是等于抛出map_err的错误e，并且被StorageError包装
*/
impl SqliteStorageAdapter{
    pub fn new(db_path:&str)->Result<Self,StorageError>{
        let conn=Connection::open(db_path)
                    .map_err(|e|StorageError::ConnectionFailed(e.to_string()))?;
        Ok(Self{conn})
    }
}
/**
struct只能定义类型的字段，
方法必须通过impl来实现，
然后impl trait for struct是用于给struct绑定对应的trait，并且实现其方法
*/

impl StoragePort for SqliteStorageAdapter {
    fn init(&self)
        ->Result<(),StorageError>{
            self.connection
                    .execute(
                    "CREATE TABLE IF NOT EXISTS api_keys (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        key TEXT NOT NULL,
                        provider TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        last_used_at TEXT
                    )",[])
                    .map_err(|e|StorageError::QueryFailed(e.to_string()))?;
            Ok(())
        }

    fn save_api_key(&self,api_key:&ApiKey)
        ->Result<(),StorageError>{
            self.connection
                    .execute(
                        "INSERT INTO api_keys (id, name, key, provider, status, created_at, updated_at, last_used_at)
                        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                       params![
                           api_key.id.0,
                           api_key.name,
                           api_key.key,
                           serde_json::to_string(&api_key.provider).unwrap(),
                           serde_json::to_string(&api_key.status).unwrap(),
                           api_key.created_at.to_rfc3339(),
                           api_key.updated_at.to_rfc3339(),
                           api_key.last_used_at.map(|dt| dt.to_rfc3339()),
                       ],
                    )
                    .map_err(|e|StorageError::QueryFailed(e.to_string()))?;
            Ok(())
        }
    
    fn get_api_key(&self, id: &str) 
        -> Result<Option<ApiKey>, StorageError> {
            let mut stmt = self.connection
                            .prepare(
                                "SELECT id, name, key, provider, status, created_at, updated_at, last_used_at FROM api_keys WHERE id = ?1"
                            )
                            .map_err(|e| StorageError::QueryFailed(e.to_string()))?;
            let result = stmt.query_row(params![id], |row| {
                // 这里需要从数据库行构建 ApiKey
                // 暂时留空，后面补全
                Ok(())
            });
            match result {
                Ok(api_key) => Ok(Some(api_key)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(StorageError::QueryFailed(e.to_string())),
            }
        }

    fn list_api_keys(&self) 
        -> Result<Vec<ApiKey>, StorageError> {
            // 先返回空 vec，后面补全
            Ok(vec![])
        }
}

/**
save_api_key借用ApiKey，这里不修改，就只&

Vec和Option只是声明类型
*/