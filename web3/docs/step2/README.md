# 第二阶段：智能合约安全（2-3 个月）

## 阶段目标

本阶段的核心目标是：
1. **掌握智能合约安全知识体系**（常见攻击类型 + 防御方法）
2. **通过 CTF 题目实战巩固安全意识**
3. **学会用高级测试手段发现漏洞**

达成标志：
- 能识别和防御常见攻击（重入、整数溢出、访问控制等）
- 能独立完成 Ethernaut 和 Damn Vulnerable DeFi 全部题目
- 能使用 Foundry 的高级测试工具（模糊测试、Hark）

---

## 每周学习节奏建议

| 周数 | 主题 | 核心任务 |
|---|---|---|
| 第 1-2 周 | 重入攻击 + 防御 | 理解 Call、Send、Transfer 的区别；ReentrancyGuard 原理 |
| 第 3 周 | 整数安全 | 上溢出/下溢出、Solidity 0.8+ 的内置保护 |
| 第 4 周 | 访问控制 + 权限 | Ownable、AccessControl、初始化漏洞 |
| 第 5 周 | 闪电贷攻击 | 理解闪电贷原理，看懂 Aave/Uni 历史漏洞 |
| 第 6-7 周 | Ethernaut CTF | 刷完 Ethernaut 全部关卡 |
| 第 8 周 | Damn Vulnerable DeFi | 理解 DeFi 协议的攻击面 |
| 第 9-10 周 | Foundry 高级测试 | Fuzz Testing、Hark 模糊测试 |
| 第 11-12 周 | 综合审计练习 | 对真实合约做安全审计 |

---

## 必学攻击类型

### 1. 重入攻击（Reentrancy）

```
攻击原理：合约 A 调用合约 B，合约 B 在完成所有操作前回调合约 A
典型场景：提款、转账、代币转移
防御手段：Checks-Effects-Interactions 模式、ReentrancyGuard
```

### 2. 整数溢出/下溢出（Integer Overflow/Underflow）

```
攻击原理：Solidity 0.7 中 uint256(0) - 1 = uint256最大值
典型场景：余额计算、循环计数
防御手段：Solidity 0.8+ 自动检查 / 使用 SafeMath
```

### 3. 访问控制漏洞（Access Control）

```
攻击原理：关键函数缺少权限校验或校验可被绕过
典型场景： ownerOnly 函数被公开调用、初始化函数未锁
防御手段：正确使用 Ownable/AccessControl、严格校验
```

### 4. 闪电贷攻击（Flash Loan Attack）

```
攻击原理：在单笔交易内借出大量资产，操控价格或投票
典型场景：AMM 价格操控、预言机操纵
防御手段：TWAP（时间加权平均价格）、延迟更新
```

### 5. 前端运行 / MEV（Front-Running / MEV）

```
攻击原理：攻击者监听内存池，用更高 gas 抢先执行交易
典型场景：AMM 套利、公开拍卖、钓鱼攻击
防御手段：commit-reveal 方案、私有交易（Flashbots Protect）
```

---

## CTF 平台推荐

### Ethernaut（OppNet）

推荐刷题顺序：

| 关卡 | 难度 | 攻击类型 |
|---|---|---|
| Fallback | ★☆☆☆☆ | 构造函数参数、合约交互 |
| Fallout | ★☆☆☆☆ | 构造函数命名错误 |
| Coin Flip | ★★☆☆☆ | 伪随机数攻击 |
| Telephone | ★★☆☆☆ | tx.origin 滥用 |
| Token | ★★☆☆☆ | 整数下溢出 |
| Delegation | ★★★☆☆ | delegatecall、Storage 布局 |
| Force | ★★★☆☆ | selfdestruct 强制转账 |
| Vault | ★★☆☆☆ | 私有变量访问 |
| King | ★★★☆☆ | 重入、拒绝服务 |
| Re-entrancy | ★★★☆☆ | 重入攻击 |
| 后续关卡 | ★★★★☆+ | 进阶内容 |

### Damn Vulnerable DeFi

| 关卡 | 攻击类型 |
|---|---|
| Unstoppable | 逻辑漏洞 |
| Trustee | ERC20 设计缺陷 |
| Sig | 签名重放 |
| SafePuzzle | 数学漏洞 |
| Puppet | 预言机操纵 |
| PuppetV2 | TWAP 防御理解 |
| TheRewarder | 奖励分配逻辑 |
| Selfie | 治理攻击 |
| Compromised | 预言机 + 闪电贷 |

---

## Foundry 高级测试工具

### Fuzz Testing（模糊测试）

```bash
forge test --fuzz-runs 10000
```

- 自动生成随机输入参数
- 发现边界条件和极端值问题
- 建议对所有公开函数加 `external` fuzz 测试

### Invariant Testing（不变量测试）

```bash
forge test --invariant
```

- 验证某些条件在整个合约生命周期内始终成立
- 例如：总存款 = 总借款 + 总利息

### Hark 模糊测试

```bash
forge watch --hark
```

- 实时监控交易序列
- 发现触发异常状态的操作组合

---

## 本阶段文档索引

```
web3/docs/
├── step1/                        ← 第一阶段：Solidity + Foundry 入门
│   ├── README.md
│   ├── 01-Forge-学习指南.md
│   ├── 02-Cast-学习指南.md
│   └── 03-DeFi协议复刻-学习指南.md
│
└── step2/                        ← 本阶段：智能合约安全
    ├── README.md                 ← 本文件（总览）
    ├── 01-CTF-Ethernaut-攻略.md  ← Ethernaut 解题思路
    └── 02-CTF-DVD-攻略.md        ← Damn Vulnerable DeFi 解题思路
```
