# 第三阶段：开源参与 + 高级话题（持续）

## 阶段目标

本阶段没有固定终点，核心目标是：

1. **参与真实开源项目，融入 Web3 开发者社区**
2. **掌握高级技术能力（形式化验证、MEV 等）**
3. **形成自己的技术判断力和影响力**

达成标志：

- 为主流 Web3 项目贡献过代码或文档
- 能用 Certora 完成基础的形式化验证
- 能独立审计一个中等复杂度合约并输出报告
- 关注并理解 MEV、跨链等前沿话题

---

## 开源参与路径

### 选择项目


| 类型      | 推荐项目                            | 参与难度  | 建议                   |
| ------- | ------------------------------- | ----- | -------------------- |
| DeFi 协议 | Uniswap、Compound、Aave、SushiSwap | ★★★☆☆ | 主流项目，文档完善，适合练手       |
| 基础设施    | OpenZeppelin、solmate、Foundry    | ★★★☆☆ | 库和工具，参与方式多（代码/测试/文档） |
| 安全工具    | Slither、Rarity、Echidna          | ★★★★☆ | 技术深度高，适合进阶           |
| 跨链协议    | LayerZero、Wormhole、Circle CCTP  | ★★★★☆ | 跨链场景复杂，适合深入研究        |


### 贡献方式

```
┌────────────────────────────────────────────────────────┐
│                    贡献阶梯                              │
├────────────────────────────────────────────────────────┤
│                                                        │
│   Lv.1  文档贡献      修 bug、补充注释、写 README       │
│   Lv.2  测试贡献      补充测试用例、提高覆盖率           │
│   Lv.3  小功能贡献     重构、提取公共库、添加小 feature   │
│   Lv.4  安全审计       发现并提交漏洞报告                │
│   Lv.5  核心贡献      设计新功能、参与架构决策           │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 参与步骤

```
1. 从 Lv.1/Lv.2 起步，在 GitHub 上提交第一个 PR
2. 在项目中找一个 "good first issue" 或 "help wanted" 标签的 issue
3. 先 fork + clone，在本地跑通测试
4. 写代码 → 写测试 → 提交 PR → 等待 review
5. 认真对待 code review 的反馈，这是最好的学习机会
```

---

## 形式化验证（Formal Verification）

### 什么是形式化验证

```
传统测试：跑 10000 次，没报错 → 可能没问题
形式化验证：用数学方法证明 → 一定没问题（在没有假设被打破的情况下）
```

### Certora Prover（推荐入门工具）

```bash
# 安装 Certora
npm install -g certora-cli

# 验证规则
certoraRun Certora/GreaterThanRule --loop_iter 5
```


| 学习路径 | 内容                                    |
| ---- | ------------------------------------- |
| 基础   | 理解 `.spec` 文件语法、正确性规则（invariants）     |
| 进阶   | 学习 CVL（Certora Verification Language） |
| 实战   | 用 Certora 验证一个 ERC20 代币的转账逻辑          |
| 综合   | 验证 Aave V3 的流动性检查逻辑                   |


### 资源推荐


| 资源                                                                             | 说明                |
| ------------------------------------------------------------------------------ | ----------------- |
| [Certora 官方文档](https://docs.certora.com/)                                      | 入门必读              |
| [Certora Examples](https://github.com/Certora/examples)                        | 官方示例仓库            |
| [Foundry + Certora 集成](https://github.com/FrankieIsLost/certora-forge-example) | 用 Forge 跑 Certora |


---

## MEV（最大可提取价值）

### 核心概念

```
MEV = 矿工/验证者通过重新排序、插入、删除交易获得的利润

常见 MEV 类型：
- Sandwich Attack（夹心攻击）  在受害者交易前后插入交易套利
- Arbitrage（套利）            利用 DEX 间价格差获利
- Liquidation（清算）          触发 DeFi 协议清算获利
- Front-Running（抢跑）        抢先执行预期的交易
```

### 技术栈


| 工具                  | 用途                   |
| ------------------- | -------------------- |
| Flashbots MEV-Boost | 将 MEV 收益返还给用户        |
| Flashbots Protect   | 保护交易免受 MEV 攻击        |
| mev-inspect-py      | 分析历史 MEV 交易          |
| Tenderly            | 模拟交易 + 调试            |
| Foundry / Forge     | 编写 Flashbots Bundles |


### 学习路径

```
1. 理解 Flashbots 的工作原理（Bundle、Relay、Builder）
2. 用 Tenderly 模拟一个 Sandwich Attack
3. 用 Foundry 写一个 MEV Bot（需要 Flashbots 账户）
4. 研究 Flashbots MEV-Boost 的验证者经济学
```

---

## 跨链互操作

### 核心概念


| 技术     | 说明                |
| ------ | ----------------- |
| 跨链桥    | 将资产从一个链转移到另一个链    |
| 跨链消息传递 | 在一条链上触发另一条链的操作    |
| 轻客户端   | 验证另一条链的状态，无需运行全节点 |


### 主流协议


| 协议          | 类型          | 推荐学习理由            |
| ----------- | ----------- | ----------------- |
| LayerZero   | 全链互操作       | 架构清晰，应用广泛         |
| Wormhole    | 跨链消息        | Guardian 验证机制值得研究 |
| CCIP        | 跨链互操作       | ChainLink 出品，安全优先 |
| Hyperlane   | sovereign跨链 | 模块化设计，适合学习        |
| Circle CCTP | 资产跨链        | 专注 USDC 跨链，机制简单   |


---

## 持续学习建议

```
┌─────────────────────────────────────────────────────────┐
│                   关注信息的渠道                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Newsletter:                                           │
│   - Week in Ethereum News（每周）                        │
│   - The Defi Prime（DeFi 动态）                         │
│   - Token Terminal（数据视角）                           │
│                                                         │
│   社区:                                                  │
│   - EthResearch（研究前沿）                             │
│   - Sovereign API（跨链讨论）                           │
│   - HackMD（白皮书共创）                                 │
│                                                         │
│   会议/活动:                                             │
│   - ETHGlobal（黑客松）                                 │
│   - Devcon（年度开发者大会）                             │
│   - ETHDenver / ETHCC（区域活动）                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 本阶段文档索引

```
web3/docs/
├── step1/                        ← 第一阶段：Solidity + Foundry 入门
├── step2/                        ← 第二阶段：智能合约安全
│
└── step3/                        ← 本阶段：开源参与 + 高级话题
    ├── README.md                 ← 本文件（总览）
    ├── 01-开源项目贡献指南.md     ← 如何参与开源项目
    ├── 02-形式化验证-Certora.md  ← Certora 入门
    └── 03-MEV与跨链.md           ← MEV 与跨链技术
```

