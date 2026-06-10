# ApiKeyInputImpl（输入端口实现 / 应用服务）

## 1. 职责定位

```
六边形架构中的位置：

  Tauri Commands / 前端
          │
          │  ← 调用
          ▼
  ┌──────────────────────┐
  │  ApiKeyInputImpl      │  ← 本文件：实现 InputPort
  │  (ApikeyApplication)  │
  └──────────┬───────────┘
             │
             ├──→ ApiKeyRepositoryOutputPort → 数据库
             └──→ CryptoServiceOutputPort     → 加密 / 验证
```

**InputImpl（应用服务）是 InputPort 的具体实现**，负责：
- 编排多个 OutputPort（仓储 + 加密）
- 实现完整的业务用例（创建、查询、更新、验证）
- 将 OutputPort 的底层错误转换为 InputPort 的对外错误

---

## 2. 核心结构

```rust
/// ApiKey 应用服务
///
/// 实现 ApikeyInputPort，编排仓储和加密两个输出端口。
/// 由 Tauri Commands（InputAdapter）调用。
pub struct ApikeyApplication {
    /// 持久化能力（由 infra 层注入）
    repository: Arc<dyn ApikeyRepositoryOutputPort>,
    /// 加密 / 验证能力（由 infra 层注入）
    crypto: Arc<dyn CryptoServiceOutputPort>,
}

impl ApikeyApplication {
    /// 构造函数，依赖由外部注入（依赖倒置）
    pub fn new(
        repository: Arc<dyn ApikeyRepositoryOutputPort>,
        crypto: Arc<dyn CryptoServiceOutputPort>,
    ) -> Self {
        Self { repository, crypto }
    }
}
```

---

## 3. 错误映射

```rust
impl ApikeyApplication {
    /// 将仓储层错误统一转换为对外的输入端口错误
    fn map_repo_error(e: ApikeyRepoError) -> ApikeyInputError {
        ApikeyInputError::RepoError(e.to_string())
    }
}
```

**为什么要做错误映射？**
- `ApikeyRepoError` / `CryptoError` / `VerifyError` 是 Infra 层的错误
- `ApikeyInputError` 是对外接口的错误
- 这样做可以隔离 Infra 层的变化，不影响外部调用者

---

## 4. create — 创建 API Key

```rust
impl ApikeyInputPort for ApikeyApplication {
    async fn create(
        &self,
        name: String,
        api_key: String,
        provider: LlmProvider,
        model: String,
        base_url: Option<String>,
    ) -> Result<ApiKey, ApikeyInputError> {
        // ① 用 CryptoService 加密明文 key
        let encrypted_key = self.crypto
            .encrypt(&api_key)
            .map_err(|e| ApikeyInputError::CryptoError(e.to_string()))?;

        // ② 用加密后的 key 构建实体
        let mut apikey = ApiKey::new(name, encrypted_key, provider, model);
        apikey.set_base_url(base_url);

        // ③ 持久化
        self.repository
            .save(&apikey)
            .await
            .map_err(Self::map_repo_error)?;

        Ok(apikey)
    }
}
```

**流程：明文 key → 加密 → 存储**

```
前端输入明文 key
        │
        ▼
  加密（crypto.encrypt）
        │
        ▼
  构建 ApiKey 实体
        │
        ▼
  持久化（repository.save）
        │
        ▼
  返回 ApiKey 给前端
```

---

## 5. get_by_id / list_all / get_default — 查询

```rust
// 按 ID 查询
async fn get_by_id(&self, id: &str) -> Result<Option<ApiKey>, ApikeyInputError> {
    self.repository
        .find_by_id(&ApiKeyId::from_string(id.to_string()))
        .await
        .map_err(Self::map_repo_error)
}

// 查询所有
async fn list_all(&self) -> Result<Vec<ApiKey>, ApikeyInputError> {
    self.repository
        .find_all()
        .await
        .map_err(Self::map_repo_error)
}

// 获取默认 Key
async fn get_default(&self) -> Result<Option<ApiKey>, ApikeyInputError> {
    self.repository
        .find_default()
        .await
        .map_err(Self::map_repo_error)
}
```

**特点：直接透传给仓储层，不做额外业务逻辑。**

---

## 6. update — 更新 API Key

```rust
async fn update(
    &self,
    id: &str,
    name: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    status: Option<KeyStatus>,
) -> Result<ApiKey, ApikeyInputError> {
    // ① 先从数据库查出原实体
    let mut apikey = self.repository
        .find_by_id(&ApiKeyId::from_string(id.to_string()))
        .await
        .map_err(Self::map_repo_error)?
        .ok_or_else(|| ApikeyInputError::NotFound(id.to_string()))?;

    // ② 按需更新各字段
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

    // 如果传入了新 key，先加密再更新
    if let Some(k) = api_key {
        let encrypted = self.crypto
            .encrypt(&k)
            .map_err(|e| ApikeyInputError::CryptoError(e.to_string()))?;
        apikey.update_key(encrypted);
    }

    // ③ 保存更新
    self.repository
        .save(&apikey)
        .await
        .map_err(Self::map_repo_error)?;

    Ok(apikey)
}
```

**update 特点：**
- 传入 `Option` 字段，只更新有值的部分（部分更新 / PATCH 语义）
- 如果提供了新 key，先用 `crypto.encrypt` 加密再存入
- 状态变更通过实体方法（`activate` / `deactivate` / `mark_expired`）处理

---

## 7. delete — 删除

```rust
async fn delete(&self, id: &str) -> Result<(), ApikeyInputError> {
    self.repository
        .delete(&ApiKeyId::from_string(id.to_string()))
        .await
        .map_err(Self::map_repo_error)
}
```

---

## 8. verify — 验证 Key 有效性

```rust
async fn verify(&self, id: &str) -> Result<bool, ApikeyInputError> {
    // ① 先查出实体
    let apikey = self.repository
        .find_by_id(&ApiKeyId::from_string(id.to_string()))
        .await
        .map_err(Self::map_repo_error)?
        .ok_or_else(|| ApikeyInputError::NotFound(id.to_string()))?;

    // ② 调用加密服务验证（实际会发 HTTP 请求到 provider）
    self.crypto
        .verify(&apikey)
        .await
        .map_err(|e| ApikeyInputError::VerifyFailed(e.to_string()))
}
```

**流程：**

```
用户请求验证
        │
        ▼
  从数据库取出加密的 key
        │
        ▼
  CryptoService.verify（解密 + 调 Provider 接口验证）
        │
        ▼
  返回 true / false
```

---

## 9. record_usage — 记录使用时间

```rust
async fn record_usage(&self, id: &str) -> Result<(), ApikeyInputError> {
    let mut apikey = self.repository
        .find_by_id(&ApiKeyId::from_string(id.to_string()))
        .await
        .map_err(Self::map_repo_error)?
        .ok_or_else(|| ApikeyInputError::NotFound(id.to_string()))?;

    apikey.record_usage();  // 实体自己检查状态并更新时间

    self.repository
        .save(&apikey)
        .await
        .map_err(Self::map_repo_error)
}
```

**注意：`record_usage` 会检查 key 是否处于 `Active` 状态。**

---

## 10. 设计原则

```
┌──────────────────────────────────────────────┐
│  InputImpl（Application）设计原则                │
├──────────────────────────────────────────────┤
│  ✅ 实现 InputPort trait                      │
│  ✅ 持有 OutputPort trait 的 Arc<dyn> 引用    │
│  ✅ 编排多个 OutputPort 完成业务用例            │
│  ✅ 将 OutputPort 错误转换为 InputPort 错误      │
│  ✅ 明文 key 在这里加密，存入实体               │
│  ✅ 不直接操作数据库（委托给 repository）        │
│  ✅ 标注 Send + Sync（满足 Tauri state 要求）   │
└──────────────────────────────────────────────┘
```

---

## 11. 与 InputTrait 的关系

| 对比项 | InputTrait（接口） | InputImpl（实现） |
|---|---|---|
| 定义位置 | `domain/apikey/` | `application/apikey/` |
| 职责 | 定义"核心能做什么" | 实现"如何做" |
| 依赖 | 无（纯接口） | `repository` + `crypto` |
| 调用者 | InputAdapter（Tauri） | InputTrait 调用方 |

---

## 12. 文件位置

```
src-tauri/src/
├── domain/
│   └── apikey/
│       ├── ApikeyEntity.rs        ← 核心实体
│       ├── ApikeyInputPort.rs      ← 输入接口定义
│       └── ApikeyOutputPort.rs     ← 输出接口定义
└── application/
    └── apikey/
        └── ApikeyApplication.rs    ← 本文件（InputPort 实现）
```
