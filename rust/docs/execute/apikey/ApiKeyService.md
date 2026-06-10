# ApiKeyService（业务服务 / 用例编排说明）

## 1. 先说明当前代码现状

在当前代码中，`apikey` 这一块**没有单独的 `ApiKeyService.rs` 文件**。

当前真正承担业务用例编排职责的是：
- `application/apikey/ApikeyApplication.rs`

也就是说，在这套代码里：
- **`ApikeyApplication` 就是当前的 ApiKeyService 角色**
- 它负责实现输入端口、编排仓储与加密输出端口、完成具体业务用例

所以本文件用于解释：**在六边形架构语义上，ApiKeyService 这个角色是什么，它在当前代码里由谁承担。**

---

## 2. Service 在六边形架构中的位置

```
前端 / Tauri Command
        │
        ▼
InputAdapter
        │
        ▼
InputPort
        │
        ▼
ApiKeyService（当前由 ApikeyApplication 承担）
        │
        ├──→ Repository OutputPort
        └──→ Crypto OutputPort
```

**Service 的职责不是存数据，也不是定义接口，而是组织一个完整业务用例。**

---

## 3. ApiKeyService 的职责

如果按职责来命名，ApiKeyService 主要负责：
- 创建 API Key
- 查询 API Key
- 更新 API Key
- 删除 API Key
- 验证 API Key
- 记录 API Key 的使用时间

这些工作在当前代码中都已经体现在 `ApikeyApplication` 里。

---

## 4. 为什么需要 Service

Entity 只负责：
- 保存自身数据
- 维护自身规则

例如：
- `activate()`
- `deactivate()`
- `update_key()`
- `record_usage()`

但一个完整业务用例通常不止操作一个实体，还会涉及：
- 查询数据库
- 加密明文 key
- 调用第三方接口验证
- 错误转换

这些事情不适合放到 Entity 里，因此需要一个 **Service / Application Service** 层来协调。

---

## 5. 当前代码里谁是 ApiKeyService

当前代码中，这个角色由 `ApikeyApplication` 承担：

```rust
pub struct ApikeyApplication {
    repository: Arc<dyn ApikeyRepositoryOutputPort>,
    crypto: Arc<dyn CryptoServiceOutputPort>,
}
```

它：
- 持有仓储输出端口
- 持有加密输出端口
- 实现 `ApikeyInputPort`
- 对外暴露完整业务能力

所以可以理解为：

```text
ApiKeyService ≈ ApikeyApplication
```

---

## 6. 典型用例：创建 API Key

```rust
async fn create(...) -> Result<ApiKey, ApikeyInputError> {
    // ① 加密明文 key
    // ② 构造 ApiKey 实体
    // ③ 调用 repository.save 持久化
    // ④ 返回结果
}
```

这个流程说明了 Service 的核心特征：
- **自己不做加密算法实现** → 交给 `crypto`
- **自己不直接操作数据库** → 交给 `repository`
- **自己负责把这些步骤串成一个用例**

---

## 7. 典型用例：更新 API Key

```rust
async fn update(...) -> Result<ApiKey, ApikeyInputError> {
    // ① 先查出已有实体
    // ② 根据传入参数做部分更新
    // ③ 如果换 key，先加密
    // ④ 保存
}
```

这个流程说明：
- Entity 提供局部业务规则
- Service 负责跨步骤编排

---

## 8. 典型用例：验证 API Key

```rust
async fn verify(&self, id: &str) -> Result<bool, ApikeyInputError> {
    // ① 查出实体
    // ② 调用 crypto.verify
    // ③ 转换验证错误
}
```

这里的关键点是：
- Service 不直接发 HTTP 请求
- 它只调用 `CryptoServiceOutputPort`
- 这样验证逻辑可以被替换、mock、测试

---

## 9. 如果以后要单独拆出 `ApiKeyService.rs`

未来如果想把结构再细化，可以改成：

```text
domain/
  apikey/
    ApikeyEntity.rs
    ApikeyInputPort.rs
    ApikeyOutputPort.rs
application/
  apikey/
    ApiKeyService.rs
    ApikeyApplication.rs
```

可能的拆分方式：
- `ApiKeyService`：纯业务用例实现
- `ApikeyApplication`：对外组装、注入、暴露接口

但在当前项目阶段，**直接由 `ApikeyApplication` 承担 Service 角色是完全合理的。**

---

## 10. Service 与 Entity / Port / Adapter 的区别

| 组件 | 作用 | 当前代码对应 |
|---|---|---|
| Entity | 核心业务对象与规则 | `ApikeyEntity.rs` |
| InputPort | 定义系统能做什么 | `ApikeyInputPort.rs` |
| OutputPort | 定义系统依赖什么 | `ApikeyOutputPort.rs` |
| Service | 编排完整业务用例 | `ApikeyApplication.rs` |
| Adapter | 对接 Tauri / DB / HTTP / 加密 | `infra/apikey/` |

---

## 11. 设计原则

```
┌──────────────────────────────────────────────┐
│  ApiKeyService 设计原则                         │
├──────────────────────────────────────────────┤
│  ✅ 负责业务用例编排                            │
│  ✅ 不直接依赖数据库、加密库、HTTP 库            │
│  ✅ 依赖 OutputPort 接口而非具体实现             │
│  ✅ 调用 Entity 方法维护业务规则                 │
│  ✅ 负责错误映射与用例级返回                     │
│  ✅ 当前项目中由 ApikeyApplication 承担此角色     │
└──────────────────────────────────────────────┘
```

---

## 12. 文件位置说明

当前没有独立的 `ApiKeyService.rs`，该角色对应位置为：

```
src-tauri/src/application/apikey/ApikeyApplication.rs
```

因此本文件更准确地说，是：
- **ApiKeyService 角色说明文档**
- **并指向当前实际实现体 `ApikeyApplication`**
