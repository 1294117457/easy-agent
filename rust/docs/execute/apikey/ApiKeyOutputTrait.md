# ApiKeyOutputTrait（输出接口）

## 1. 职责定位

```
六边形架构中的位置：

      ApikeyApplication / ApiKeyService
                    │
                    │  依赖接口（OutputPort）
                    ▼
          ┌──────────────────────┐
          │  ApiKeyOutputTrait    │
          │  定义核心需要的外部能力  │
          └──────────┬───────────┘
                     │
                     │ 由基础设施层实现
                     ▼
          ┌──────────────────────┐
          │  ApiKeyOutputImpl     │
          │ 数据库 / 加密 / 网络    │
          └──────────────────────┘
```

**OutputTrait / OutputPort** 的职责是：
- 定义核心业务完成用例时所依赖的外部能力
- 只描述契约，不描述实现细节
- 让应用层依赖接口，而不是依赖数据库 / 加密 / 网络库

---

## 2. 对应代码文件

当前文档对应的代码文件是：

```text
src-tauri/src/domain/apikey/ApiKeyOutputPort.rs
```

该文件里当前定义了两组输出能力：
- `ApiKeyOutputPort`：仓储输出端口
- `CryptoServiceOutputPort`：加密 / 验证输出端口

以及对应错误：
- `ApikeyRepoError`
- `CryptoError`
- `VerifyError`

---

## 3. 为什么需要 OutputTrait

如果应用服务直接依赖：
- SQLite
- AES / 加密库
- HTTP Client

会导致：
- 核心业务和基础设施强耦合
- 测试时难以 mock
- 替换数据库或加密实现的成本高

所以要在 `domain` 层先定义接口，再由 `infra` 层实现。

---

## 4. 仓储输出端口：ApiKeyOutputPort

```rust
#[async_trait]
pub trait ApiKeyOutputPort: Send + Sync {
    async fn find_by_id(&self, id: &ApiKeyId)
        -> Result<Option<ApiKey>, ApiKeyRepoError>;

    async fn find_all(&self)
        -> Result<Vec<ApiKey>, ApiKeyRepoError>;

    async fn fin_by_status(&self, status: KeyStatus)
        -> Result<Vec<ApiKey>, ApiKeyRepoError>;

    async fn find_default(&self)
        -> Result<Option<ApiKey>, ApiKeyRepoError>;

    async fn save(&self, api_key: ApiKey)
        -> Result<ApiKey, ApiKeyRepoError>;
}
```

### 方法说明

| 方法 | 作用 |
|---|---|
| `find_by_id` | 按 ID 查询一个 `ApiKey` |
| `find_all` | 查询全部 `ApiKey` |
| `fin_by_status` | 按状态查询 |
| `find_default` | 查询默认 Key |
| `save` | 保存一个 `ApiKey` |

> 备注：当前代码里方法名写的是 `fin_by_status`，少了一个 `d`。本文档按现有代码名说明，不修改代码。

---

## 5. 仓储错误：ApikeyRepoError

```rust
#[derive(Debug, thiserror::Error)]
pub enum ApikeyRepoError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),
}
```

### 含义说明

| 错误类型 | 说明 |
|---|---|
| `NotFound` | 数据不存在 |
| `DatabaseError` | 数据库执行失败 |
| `SerializationError` | 数据转换 / 序列化失败 |

---

## 6. 加密输出端口：CryptoServiceOutputPort

```rust
pub trait CryptoServiceOutputPort: Send + Sync {
    fn encrypt(&self, plaintext: &str) -> Result<String, CryptoError>;

    fn decrypt(&self, ciphertext: &str) -> Result<String, CryptoError>;

    fn verify(&self, apikey: &ApiKey)
        -> impl Future<Output = Result<bool, VerifyError>> + Send;
}
```

### 方法说明

| 方法 | 作用 |
|---|---|
| `encrypt` | 把明文 key 加密成密文 |
| `decrypt` | 把密文恢复成明文 |
| `verify` | 调用外部 Provider 验证 key 是否有效 |

---

## 7. 加密与验证错误

### 7.1 CryptoError

```rust
#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),

    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),

    #[error("Invalid key length")]
    InvalidKeyLength,
}
```

### 7.2 VerifyError

```rust
#[derive(Debug, thiserror::Error)]
pub enum VerifyError {
    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    #[error("Authentication failed")]
    AuthFailed,
}
```

---

## 8. 当前代码中的调用关系

```
ApikeyApplication
        │
        ├── repository.find_by_id(...)
        ├── repository.find_all(...)
        ├── repository.save(...)
        ├── crypto.encrypt(...)
        └── crypto.verify(...)
                │
                ▼
         ApiKeyOutputTrait
                │
                ▼
     Infra Adapter / OutputImpl
```

---

## 9. 与 InputTrait 的区别

| 对比项 | InputTrait | OutputTrait |
|---|---|---|
| 方向 | 外部 → 核心 | 核心 → 外部 |
| 描述内容 | 系统能做什么 | 系统依赖什么 |
| 调用者 | 前端 / Tauri Command | Application / Service |
| 实现者 | Application | Infra |

---

## 10. 设计原则

```
┌─────────────────────────────────────────────┐
│  OutputTrait 设计原则                         │
├─────────────────────────────────────────────┤
│  ✅ 定义在 domain 层                           │
│  ✅ 只定义接口，不写实现                        │
│  ✅ 由 infra 层实现                            │
│  ✅ 隔离数据库 / 加密 / 网络依赖                 │
│  ✅ 返回领域对象或统一错误类型                   │
│  ✅ 支持测试时替换真实实现                        │
└─────────────────────────────────────────────┘
```

---

## 11. 文件位置

```
src-tauri/src/
└── domain/
    └── apikey/
        ├── mod.rs
        ├── ApiKeyEntity.rs
        ├── ApiKeyInputPort.rs
        └── ApiKeyOutputPort.rs   ← 本文档对应代码
```
