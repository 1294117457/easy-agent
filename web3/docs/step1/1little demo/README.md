# 小项目练习

5 个难度递增的 Solidity 小项目，每个项目包含详细实现指南和相关知识补充。

---

## 项目列表

| # | 项目名称 | 难度 | 核心概念 | 推荐指数 |
|---|---|---|---|---|
| 01 | SimpleStorage | ⭐ | 状态变量、函数、Forge 测试 | 入门必做 |
| 02 | TokenFaucet | ⭐⭐ | ERC20、mapping、OpenZeppelin | 入门必做 |
| 03 | VendingMachine | ⭐⭐⭐ | payable、ReentrancyGuard、ETH交互 | 进阶 |
| 04 | BulletinBoard | ⭐⭐⭐ | struct、event、分页查询 | 进阶 |
| 05 | SimpleAuction | ⭐⭐⭐⭐ | 状态机、block.timestamp、押金模式 | 高阶 |

---

## 学习顺序建议

```
建议按顺序完成，不要跳步

第 1-2 周：SimpleStorage + TokenFaucet（1-2 天一个）
第 3 周：   VendingMachine（熟悉 ETH 交互）
第 4 周：   BulletinBoard（熟悉数据结构）
第 5 周：   SimpleAuction（综合练习）
```

---

## 每个项目的结构

```
01-SimpleStorage/
├── README.md          ← 项目简介和学习目标
├── IMPLEMENTATION.md ← 一步步实现指南（含代码）
└── KNOWLEDGE.md      ← 相关知识补充
```

---

## 快速导航

### 01-SimpleStorage - 最简单的存储合约

**做什么**：存一个数字，可以修改，可以读取。

**学到什么**：
- Solidity 基础语法（状态变量、函数、visibility）
- `public` 变量自动生成 getter
- Forge 写测试跑通第一个合约

**验收标准**：部署到 Sepolia 测试网 + 用 Cast 查询和修改值 + 3 个测试用例

[查看详细指南](./01-SimpleStorage/README.md)

---

### 02-TokenFaucet - 代币水龙头

**做什么**：一个自定义 ERC20 代币水龙头，任何人可以"领"代币，每人限领一次。

**学到什么**：
- ERC20 标准（transfer、balanceOf、totalSupply）
- require 和错误处理
- mapping 追踪领取记录

**验收标准**：通过 OpenZeppelin 继承实现 + 测试覆盖所有分支

[查看详细指南](./02-TokenFaucet/README.md)

---

### 03-VendingMachine - 自动售卖机

**做什么**：ETH 和 ERC20 双向兑换，存 ETH 获得代币，或销毁代币换回 ETH。

**学到什么**：
- payable 函数和 address(this).balance
- 重入攻击的初步认识（ReentrancyGuard）
- CEI 模式

**验收标准**：完整测试覆盖 + 部署到测试网 + Cast 验证

[查看详细指南](./03-VendingMachine/README.md)

---

### 04-BulletinBoard - 链上留言板

**做什么**：任何人都可以留言，可以按页查询历史留言。

**学到什么**：
- struct 和 event
- 动态数组 + 分页查询
- storage / memory / calldata 的区别

**验收标准**：支持分页 + Cast 监听事件 + 100% 测试覆盖

[查看详细指南](./04-BulletinBoard/README.md)

---

### 05-SimpleAuction - 简单拍卖

**做什么**：卖家发起拍卖，买家出价 ETH，截止后最高出价者赢得，其他人可以取回押金。

**学到什么**：
- 时间锁（block.timestamp）
- 状态机设计（Pending → Active → Ended）
- Pull 模式取回押金

**验收标准**：状态转换正确 + 押金逻辑正确 + 合约余额正确

[查看详细指南](./05-SimpleAuction/README.md)

---

## 完成标准

每个项目的验收标准都在其 README.md 中列出，基本标准是：

```
✅ 代码写完
✅ forge test 全部通过
✅ 测试覆盖率 100%（或接近 100%）
✅ 部署到 Sepolia 测试网
✅ 用 Cast 验证链上行为
```

达到这些标准说明你真正理解了这个项目的核心概念。
