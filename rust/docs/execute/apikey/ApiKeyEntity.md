# ApiKeyEntity（实体层）

## 1. 职责定位

```
六边形架构中的位置：

       ┌─────────────────────┐
       │      Domain         │
       │  ┌───────────────┐  │
       │  │  ApiKeyEntity  │  │  ← 核心中的核心
       │  └───────────────┘  │
       └─────────────────────┘
```

**Entity 是业务核心对象**，负责：
- 持有 API Key 的核心业务数据
- 封装状态切换、更新时间、使用记录等业务规则
- 不依赖数据库实现、Tauri、HTTP 适配器等外部基础设施

---

## 2. 对应代码文件

当前文档对应的代码文件是：

```text
src-tauri/src/domain/apikey/ApiKeyEntity.rs
```

当前文件中主要定义了 3 类内容：
- `ApiKeyId`
- `KeyStatus`
- `ApiKey`

> 注意：当前代码里的 `ApiKeyEntity.rs` **没有 `LlmProvider`**，因此本文档按现有代码说明，不扩展未出现在该文件中的类型。

---

## 3. ApiKeyId（值对象）

```rust
#[derive(Debug Clone Deserialize Serialize PartialEq)]
pub struct ApiKeyId(pub String);

impl ApiKeyId {
    pub fn new() -> Self {
        Self(Uuid::new_v4().to_string())
    }

    pub fn from_string(s: String) -> Self {
        Self(s)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl Default for ApiKeyId {
    fn default() -> Self {
        Self::new()
    }
}
```

### 作用

- 封装 API Key 的唯一标识
- 避免业务代码到处直接传裸 `String`
- 使用 `Uuid::new_v4()` 自动生成新 ID

### 方法说明

| 方法 | 作用 |
|---|---|
| `new()` | 生成新的 UUID 作为 ID |
| `from_string(s)` | 从已有字符串重建 ID |
| `as_str()` | 取出内部字符串引用 |
| `Default::default()` | 默认生成一个新 ID |

---

## 4. KeyStatus（状态枚举）

```rust
#[derive(Debug Clone Deserialize Serialize PartialEq)]
pub enum KeyStatus {
    Active,
    Inactive,
    Expired,
}
```

### 含义

| 状态 | 含义 |
|---|---|
| `Active` | 当前可用 |
| `Inactive` | 手动停用 |
| `Expired` | 已过期或已失效 |

---

## 5. ApiKey（聚合根实体）

```rust
pub struct ApiKey {
    pub id: ApiKeyId,
    pub name: String,
    pub encrypted_key: String,
    pub base_url: Option<String>,
    pub status: KeyStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `ApiKeyId` | 唯一标识 |
| `name` | `String` | 用户命名 |
| `encrypted_key` | `String` | 加密后的 API Key |
| `base_url` | `Option<String>` | 可选自定义地址 |
| `status` | `KeyStatus` | 当前状态 |
| `created_at` | `DateTime<Utc>` | 创建时间 |
| `updated_at` | `DateTime<Utc>` | 最近更新时间 |
| `last_used_at` | `Option<DateTime<Utc>>` | 最近使用时间 |

**重点：当前实体只保存 `encrypted_key`，不保存明文 key。**

---

## 6. 构造与重建

### 6.1 新建实体

```rust
impl ApiKey {
    pub fn new(name: String, encrypted_key: String, base_url: Option<String>) -> Self {
        Self {
            id: ApiKeyId::new(),
            name,
            encrypted_key,
            base_url,
            status: KeyStatus::Active,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            last_used_at: None,
        }
    }
}
```

### 6.2 从持久化数据重建实体

```rust
pub fn reconstitute(
    id: ApiKeyId,
    name: String,
    encrypted_key: String,
    base_url: Option<String>,
    status: KeyStatus,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    last_used_at: Option<DateTime<Utc>>,
) -> Self
```

### 为什么要区分 `new` 和 `reconstitute`

- `new` 用于创建新对象
- `reconstitute` 用于从数据库恢复已有对象
- 这样可以清晰区分“新建”与“重建”两种语义

---

## 7. 实体业务方法

### 7.1 状态判断与状态流转

```rust
pub fn is_active(&self) -> bool {
    self.status == KeyStatus::Active
}

pub fn activate(&mut self) {
    self.status = KeyStatus::Active;
    self.updated_at = Utc::now();
}

pub fn deactivate(&mut self) {
    self.status = KeyStatus::Inactive;
    self.updated_at = Utc::now();
}

pub fn mark_expired(&mut self) {
    self.status = KeyStatus::Expired;
    self.updated_at = Utc::now();
}
```

### 7.2 更新密钥与地址

```rust
pub fn update_key(&mut self, encrypted_key: String) {
    self.encrypted_key = encrypted_key;
    self.updated_at = Utc::now();
}

pub fn set_base_url(&mut self, _url: Option<String>) {
    self.base_url = _url;
    self.updated_at = Utc::now();
}
```

### 7.3 记录使用时间

```rust
pub fn record_usage(&mut self) {
    if !self.is_active() {
        return Err("Cannot record usage for inactive key".to_string());
    }
    self.last_used_at = Some(Utc::now());
    self.updated_at = Utc::now();
}
```

### 业务含义

- 只有 `Active` 状态才允许记录使用行为
- 每次实体发生变更，都会刷新 `updated_at`
- `record_usage` 会同时更新 `last_used_at` 与 `updated_at`

> 备注：当前代码中 `record_usage` 的签名写成了 `pub fn record_usage(&mut self)`，但函数体里有 `return Err(...)`，说明这里本意应是返回 `Result<(), String>`。本文档只说明现有业务意图，不修改代码。

---

## 8. Entity 的边界

`ApiKeyEntity` **负责业务规则**，但**不负责以下事情**：
- 不直接访问数据库
- 不做 API Key 加密算法实现
- 不发网络请求验证第三方 Provider
- 不处理 Tauri Command 输入输出

这些职责应分别交给：
- `OutputPort / OutputImpl`
- `InputAdapter`
- `Application / Service`

---

## 9. 设计原则

```
┌─────────────────────────────────────────────┐
│  Entity 设计原则                              │
├─────────────────────────────────────────────┤
│  ✅ 封装核心业务数据                            │
│  ✅ 封装状态变更与时间更新规则                  │
│  ✅ 不依赖数据库 / Tauri / 网络                 │
│  ✅ 使用值对象 ApiKeyId 提升类型语义            │
│  ✅ 保存 encrypted_key，而不是明文 key          │
└─────────────────────────────────────────────┘
```

---

## 10. 文件位置

```
src-tauri/src/
└── domain/
    └── apikey/
        ├── mod.rs
        ├── ApiKeyEntity.rs      ← 本文档对应代码
        ├── ApiKeyInputPort.rs
        └── ApiKeyOutputPort.rs
```
