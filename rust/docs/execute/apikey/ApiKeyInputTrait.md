# ApiKeyInputTrait（输入接口）

## 1. 职责定位

```
六边形架构中的位置：

  Tauri Commands / 前端
          │
          │  调用输入端口
          ▼
  ┌─────────────────────┐
  │  ApiKeyInputTrait    │  ← 本文件：定义系统“能做什么”
  └──────────┬──────────┘
             │
             │ 由应用层实现
             ▼
  ┌─────────────────────┐
  │  ApiKeyInputImpl     │
  │ (ApikeyApplication)  │
  └─────────────────────┘
```

**InputTrait / InputPort** 的职责是：
- 定义外部可以调用哪些核心能力
- 只描述接口契约，不写具体实现
- 作为前端 / Tauri 与核心业务之间的边界

---

## 2. 对应代码文件

当前文档对应的代码文件是：

```text
src-tauri/src/domain/apikey/ApiKeyInputPort.rs
```

该文件定义了：
- `ApiKeyInputPort` trait
- `ApikeyInputError` 错误类型

---

## 3. ApiKeyInputPort 定义

```rust
pub trait ApiKeyInputPort: Send + Sync {
    async fn create(
        &self,
        name: String,
        api_key: String,
        base_url: Option<String>,
    ) -> Result<ApiKey, ApiKeyInputError>;

    async fn get_by_id(&self, id: &str) -> Result<Option<ApiKey>, ApiKeyInputError>;

    async fn list_all(&self) -> Result<Vec<ApiKey>, ApiKeyInputError>;

    async fn get_default(&self) -> Result<Option<ApiKey>, ApiKeyInputError>;

    async fn update(
        &self,
        id: &str,
        api_key: String,
        base_url: Option<String>,
        status: KeyStatus,
    ) -> Result<ApiKey, ApiKeyInputError>;

    async fn verify(&self, id: &str) -> Result<(), ApiKeyInputError>;

    async fn record_usage(&self, id: &str) -> Result<(), ApiKeyInputError>;
}
```

---

## 4. 方法说明

| 方法 | 输入 | 输出 | 说明 |
|---|---|---|---|
| `create` | `name`, `api_key`, `base_url` | `ApiKey` | 创建新的 API Key |
| `get_by_id` | `id` | `Option<ApiKey>` | 按 ID 查询 |
| `list_all` | - | `Vec<ApiKey>` | 查询全部 |
| `get_default` | - | `Option<ApiKey>` | 获取默认 Key |
| `update` | `id`, `api_key`, `base_url`, `status` | `ApiKey` | 更新已有 API Key |
| `verify` | `id` | `()` | 验证指定 Key |
| `record_usage` | `id` | `()` | 记录一次使用行为 |

---

## 5. 为什么这是 InputPort

这是一个典型的 **Driving Port**：
- 外部系统（前端、Tauri Command）通过它驱动核心用例
- 它描述的是“系统能做什么”
- 它不关心底层数据库、加密、网络细节

对应关系如下：

| 维度 | InputPort |
|---|---|
| 调用方向 | 外部 → 核心 |
| 调用者 | 前端 / Tauri Command |
| 实现者 | Application / Service |
| 关注点 | 系统提供哪些业务能力 |

---

## 6. 错误类型：ApikeyInputError

```rust
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
```

### 含义说明

| 错误类型 | 含义 |
|---|---|
| `CryptoError` | 加密或解密相关失败 |
| `RepoError` | 仓储 / 数据库相关失败 |
| `NotFound` | 未找到指定资源 |
| `InvalidInput` | 输入参数不合法 |
| `VerifyFailed` | 第三方验证失败 |

---

## 7. InputTrait 的设计特点

### 7.1 用 async

这些接口大多最终会触发：
- 数据库访问
- 网络验证
- 异步持久化

所以这里采用异步方法签名。

### 7.2 用 `Send + Sync`

```rust
pub trait ApiKeyInputPort: Send + Sync
```

这是为了让实现体可以安全地：
- 共享在多线程异步运行时中
- 被 Tauri 的状态管理或依赖注入安全持有

### 7.3 返回 `Result`

对外接口必须显式表达失败场景，因此所有方法都返回：

```rust
Result<T, ApiKeyInputError>
```

这样调用方可以决定如何展示错误，而不是在核心层 `panic!`。

---

## 8. 与 OutputTrait 的区别

| 对比项 | InputTrait | OutputTrait |
|---|---|---|
| 方向 | 外部 → 核心 | 核心 → 外部 |
| 作用 | 定义系统能做什么 | 定义系统依赖什么 |
| 调用者 | 前端 / Command | Application / Service |
| 实现者 | Application | Infra Adapter |

---

## 9. 当前代码中的调用链

```
前端 / Tauri Command
        │
        ▼
ApiKeyInputPort
        │
        ▼
ApikeyApplication
        │
        ├──→ ApiKeyOutputPort
        └──→ CryptoServiceOutputPort
```

---

## 10. 设计原则

```
┌─────────────────────────────────────────────┐
│  InputTrait 设计原则                          │
├─────────────────────────────────────────────┤
│  ✅ 定义在 domain 层                           │
│  ✅ 只定义接口，不写实现                        │
│  ✅ 作为对外业务能力边界                        │
│  ✅ 返回统一错误类型 ApikeyInputError          │
│  ✅ 使用 async 适配 IO 场景                    │
│  ✅ 使用 Send + Sync 满足共享与并发要求        │
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
        ├── ApiKeyInputPort.rs    ← 本文档对应代码
        └── ApiKeyOutputPort.rs
```
