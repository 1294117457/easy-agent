# ApiKeyOutputImpl（输出端口实现 / 基础设施适配器）

## 1. 职责定位

```
六边形架构中的位置：

      ApikeyApplication
              │
              │  依赖接口（OutputPort）
              ▼
   ┌──────────────────────────┐
   │   ApiKeyOutputTrait       │
   └────────────┬─────────────┘
                │
                │ 由 Infra 层实现
                ▼
   ┌──────────────────────────┐
   │   ApiKeyOutputImpl        │
   │ (OutputAdapter / Adapter) │
   └────────────┬─────────────┘
                ├── SQLite / 持久化
                ├── AES / 加密解密
                └── HTTP Client / Provider 验证
```

**OutputImpl 是 OutputPort 的基础设施实现**，负责：
- 对接数据库，实现 `ApiKeyOutputPort` 的持久化能力
- 对接加密能力，实现 `CryptoServiceOutputPort`
- 对接网络请求，实现 API Key 的有效性验证

---

## 2. 当前代码现状

在当前项目中：
- `src/infra/apikey/ApiKeyInputAdapter.rs` 为空
- `src/infra/apikey/ApiKeyOutputAdapter.rs` 为空
- 但 `infra/apikey/mod.rs` 已经预留了模块导出位置

这说明：
- **架构位置已经定义好**
- **输出适配器文件已经建立**
- **具体实现尚未完成**

所以本文件说明的是：**`ApiKeyOutputImpl` 在本架构中的职责、应实现的接口、以及推荐实现方式。**

---

## 3. OutputImpl 要实现哪些接口

`ApiKeyOutputImpl` 通常不止一个结构体，而是多个适配器实现多个输出端口。

### 3.1 仓储输出端口实现

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

推荐由一个仓储适配器来实现，例如：

```rust
pub struct SqliteApiKeyOutputAdapter {
    // sqlite 连接池或数据库句柄
}

#[async_trait]
impl ApiKeyOutputPort for SqliteApiKeyOutputAdapter {
    // 实现 find_by_id / find_all / save ...
}
```

### 3.2 加密输出端口实现

```rust
pub trait CryptoServiceOutputPort: Send + Sync {
    fn encrypt(&self, plaintext: &str) -> Result<String, CryptoError>;
    fn decrypt(&self, ciphertext: &str) -> Result<String, CryptoError>;
    fn verify(&self, apikey: &ApiKey)
        -> impl Future<Output = Result<bool, VerifyError>> + Send;
}
```

推荐由一个加密/验证适配器实现，例如：

```rust
pub struct DefaultCryptoOutputAdapter {
    // 加密配置、HTTP Client 等
}

impl CryptoServiceOutputPort for DefaultCryptoOutputAdapter {
    // 实现 encrypt / decrypt / verify
}
```

---

## 4. 仓储适配器职责

仓储适配器的目标是：**把数据库记录和领域实体 `ApiKey` 做双向转换。**

### 4.1 查询：数据库记录 → Entity

```rust
async fn find_by_id(&self, id: &ApiKeyId)
    -> Result<Option<ApiKey>, ApiKeyRepoError> {
    // ① 从数据库按 id 查行
    // ② 把行数据映射为 ApiKey::reconstitute(...)
    // ③ 返回领域实体
}
```

### 4.2 保存：Entity → 数据库记录

```rust
async fn save(&self, api_key: ApiKey)
    -> Result<ApiKey, ApiKeyRepoError> {
    // ① 读取 entity 的字段
    // ② 执行 insert 或 update
    // ③ 返回保存后的实体
}
```

### 4.3 设计要点

- 数据库层只存 `encrypted_key`，不存明文 key
- 使用 `ApiKey::reconstitute(...)` 从数据库恢复实体
- 数据库异常统一转换成 `ApiKeyRepoError`

---

## 5. 加密适配器职责

### 5.1 encrypt

```rust
fn encrypt(&self, plaintext: &str) -> Result<String, CryptoError> {
    // 用对称加密算法把明文 key 加密
}
```

用途：
- 在 `ApikeyApplication::create` 和 `update` 中调用
- 保证数据库中只保存密文

### 5.2 decrypt

```rust
fn decrypt(&self, ciphertext: &str) -> Result<String, CryptoError> {
    // 把密文还原成明文，供 Provider 请求时临时使用
}
```

用途：
- 一般不直接暴露给前端
- 只在需要调用第三方 Provider 时临时解密

### 5.3 verify

```rust
fn verify(&self, apikey: &ApiKey)
    -> impl Future<Output = Result<bool, VerifyError>> + Send {
    // ① 读取 apikey.encrypted_key
    // ② 先 decrypt
    // ③ 构造 provider 请求
    // ④ 调用 Provider 的测试接口
    // ⑤ 根据响应判断 true / false
}
```

**verify 不是只看格式，而是调用真实 Provider 做校验。**

---

## 6. OutputImpl 的调用链

```
前端 / Tauri Command
        │
        ▼
InputAdapter
        │
        ▼
ApikeyApplication
        │
        ├── repository.find_by_id(...) ──→ OutputImpl（数据库）
        ├── repository.save(...)       ──→ OutputImpl（数据库）
        ├── crypto.encrypt(...)        ──→ OutputImpl（加密）
        └── crypto.verify(...)         ──→ OutputImpl（网络验证）
```

---

## 7. 为什么 OutputImpl 必须在 Infra 层

如果把数据库、HTTP、加密直接写在 `ApikeyApplication` 里，会导致：
- 应用服务强依赖具体实现
- 测试困难，无法 mock
- 替换 SQLite / AES / reqwest 成本高

所以应该：
- 在 `domain` 定义 `OutputPort`
- 在 `infra` 提供 `OutputImpl`
- 在 `application` 只依赖 trait

这就是依赖倒置原则。

---

## 8. 推荐的实现拆分

推荐不要把所有能力都塞进一个结构体里，而是拆成两个实现：

| 实现体 | 实现接口 | 职责 |
|---|---|---|
| `SqliteApiKeyOutputAdapter` | `ApiKeyOutputPort` | 持久化 |
| `DefaultCryptoOutputAdapter` | `CryptoServiceOutputPort` | 加密、解密、验证 |

这样比“一个超级 OutputImpl”更清晰，也更符合单一职责。

---

## 9. 设计原则

```
┌──────────────────────────────────────────────┐
│  OutputImpl（Infra Adapter）设计原则            │
├──────────────────────────────────────────────┤
│  ✅ 实现 domain 中定义的 OutputPort             │
│  ✅ 放在 infra 层                              │
│  ✅ 负责数据库 / 加密 / 网络等外部依赖接入       │
│  ✅ 不承载业务流程编排（那是 Application 的事）   │
│  ✅ 数据库记录和 Entity 之间做映射               │
│  ✅ 底层异常转换成 RepoError / CryptoError 等     │
└──────────────────────────────────────────────┘
```

---

## 10. 文件位置

```
src-tauri/src/
├── domain/
│   └── apikey/
│       └── ApikeyOutputPort.rs      ← 输出端口定义
└── infra/
    └── apikey/
        ├── ApiKeyInputAdapter.rs
        └── ApiKeyOutputAdapter.rs   ← 本模块未来实现 OutputImpl
```
