# 第一阶段：Solidity + Foundry 入门（1-2 个月）

## 阶段目标

本阶段的核心目标是：
1. **熟练使用 Forge 编写合约 + 测试**
2. **用 Cast 做链上交互和数据查询**
3. **复刻几个主流 DeFi 协议，理解其核心机制**

达成标志：
- 能独立用 Foundry 完成一个合约从写、测、部署的全流程
- 能用 Cast 查询链上数据、调试合约
- 能理解 Uniswap V2 等主流协议的白皮书级别的设计逻辑

---

## 学习理念总览

```
┌────────────────────────────────────────────────────┐
│                  第一阶段学习理念                       │
├────────────────────────────────────────────────────┤
│                                                    │
│   ① 学 Solidity 语法 → 不是目的，是工具              │
│                                                    │
│   ② 学 Forge / Cast       → 提升开发效率的武器        │
│                                                    │
│   ③ 理解 DeFi 机制        → 真正区分你与别人的核心    │
│                              Web3 开发者靠的是        │
│                              理解机制，不是会写合约    │
│                                                    │
│   ④ 测试驱动开发（TDD）   → 安全意识从第一天开始培养   │
│                                                    │
│   ⑤ 阅读开源项目源码       → 站在巨人的肩膀上学习      │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## 每周学习节奏建议

| 周数 | 主题 | 核心任务 |
|---|---|---|
| 第 1 周 | 搭建环境 + Solidity 基础 | 安装 Foundry，跑通第一个合约 |
| 第 2 周 | Solidity 进阶 | 继承、库、接口、存储布局 |
| 第 3 周 | Forge 核心 | 写测试、模糊测试、部署脚本 |
| 第 4 周 | Cast 工具链 | 用 Cast 查链上数据，调试合约 |
| 第 5-6 周 | Uniswap V2 机制 | 理解 AMM、恒定乘积公式、流动性 |
| 第 7 周 | Uniswap V2 复刻 | 用 Foundry 写一个简化版 Uniswap |
| 第 8 周 | 更多 DeFi 协议 | Aave / Compound / Curve 核心机制 |

---

## 必学核心理念

### 1. TDD — 测试驱动开发

在 Web3 合约开发中，**测试不是可选项，是命根子**。

- 上链后合约无法修改（除非有升级机制），bug 代价极高
- Foundry 的模糊测试（Fuzz Testing）能自动生成边界测试用例
- 从第一天起养成"先写测试，再写合约"的习惯

### 2. 依赖倒置与接口设计

- 合约之间通过接口（Interface）交互
- 不要在业务合约里写死具体实现
- 这套理念和 Rust 的 trait、Java 的 interface 一脉相承

### 3. 存储布局（Storage Layout）

- 理解 `slot 0`、`slot 1` ... 是怎么存的
- 理解 `mapping` 的存储方式：`keccak256(key . slot)`
- 理解定长数组 vs 动态数组的区别
- **这是理解合约安全问题的前提**（比如storage冲突漏洞）

### 4. EVM 执行模型

- 理解 Call Stack（调用栈深度限制 1024）
- 理解 Gas 机制：为什么有时候交易会失败
- 理解 `delegatecall`：这是代理合约和 EIP-1167 Clone 的基础

### 5. OpenZeppelin 是你的好朋友

- 不要重复造轮子
- `ReentrancyGuard`、`Pausable`、`AccessControl`、`ERC20`、`Ownable`
- 这些经过审计的库是行业标准，面试中也默认你会用

---

## 每日学习结构（建议）

```
30 分钟 — 复习昨天学的概念（用自己的话写笔记）
60 分钟 — 看文档 / 教程，写代码
30 分钟 — 用 Foundry 跑测试
30 分钟 — 读一个开源合约的源码
30 分钟 — 用 Cast 查链上数据（今天学的协议）
```

---

## 推荐学习资源

| 资源 | 类型 | 说明 |
|---|---|---|
| [Solidity by Example](https://solidity-by-example.org/) | 文档 | 学语法必读 |
| [Foundry Book](https://book.getfoundry.sh/) | 文档 | Forge/Cast 官方文档 |
| [Cyfrin / Patrick Collins 的 Foundry 课程](https://updraft.cyfrin.io/) | 视频 | B站有翻译，强烈推荐 |
| [CryptoZombies](https://cryptozombies.io/) | 交互教程 | 入门友好 |
| [Ethernaut](https://ethernaut.openzeppelin.com/) | 实战题 | 通过 hacking 学安全 |
| [Damn Vulnerable DeFi](https://www.damnvulnerabledefi.xyz/) | 实战题 | DeFi 安全审计必做 |

---

## 本阶段文档索引

```
web3/docs/
└── step1/
    ├── README.md                      ← 本文件（总览）
    ├── 01-Forge-学习指南.md            ← Forge 工具链
    ├── 02-Cast-学习指南.md             ← Cast 链上交互
    └── 03-DeFi协议复刻-学习指南.md      ← DeFi 协议理解与复刻
```
