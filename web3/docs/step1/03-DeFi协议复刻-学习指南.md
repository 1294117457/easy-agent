# 03 - DeFi 协议复刻学习指南

## 理念：复刻不是抄代码，是重建思维

```
复刻的正确理解：
  不是把 Uniswap 的代码复制过来跑通
  而是：
  ① 理解它要解决什么问题
  ② 理解它的核心数学模型
  ③ 理解它如何用代码实现这个模型
  ④ 自己动手实现一个简化版
  ⑤ 对比原版，理解为什么那样写
```

这个阶段的重点是 **理解机制**，不是为了写代码而写代码。

---

## 为什么要从 Uniswap V2 开始

```
Uniswap V2 是 DeFi 的"Hello World"：

① AMM 机制 — 所有 DEX 的基础
② 恒定乘积公式 — 简单数学，深度理解
③ 流动性池 — LP 机制，一次性理解
④ 费用机制 — 每笔交易 0.3% 给 LP
⑤ 路由问题 — 为什么需要多跳
⑥ 价格预言机 — TWAP，链上价格平滑
```

Uniswap V2 的代码量不大（核心约 300 行），但机制完整。

---

## Uniswap V2 — 核心机制拆解

### 1. 恒定乘积公式（Constant Product Market Maker）

这是 Uniswap 的数学核心：

```
x * y = k
```

其中：
- `x` = Token0 的储备量
- `y` = Token1 的储备量
- `k` = 恒定乘积（交易前后不变）

**交易公式（买入 Token1）**：

```
(x + Δx) * (y - Δy) = k

展开：
y - Δy = k / (x + Δx)
Δy = y - k / (x + Δx)
```

实际代码中的计算（Solidity）：

```solidity
uint amountInWithFee = amountIn * 997;  // 扣 0.3% 手续费
uint numerator = amountInWithFee * reserveOut;
uint denominator = reserveIn * 1000 + amountInWithFee;
uint amountOut = numerator / denominator;
```

### 2. 流动性池（Liquidity Pool）

LP（流动性提供者）的核心逻辑：

- 存入两种代币，比例必须为 1:1（按当前价格）
- 获得 LP Token，代表份额
- 交易手续费 0.3% 会累积到池子里
- LP 可以随时按比例赎回本金 + 手续费

**LP Token 铸造公式**：

```
shares = (amount * totalShares) / reserve
```

即：存入 10% 的流动性，获得 10% 的 shares。

### 3. 初始化流动性（首次添加）

Uniswap V2 的一个设计：**第一次添加流动性没有手续费收益**，这是为了防止初始价格操控。

```solidity
if (_totalSupply == 0) {
    // 第一次：shares = sqrt(x * y)
    amount = sqrt(amount0 * amount1);
} else {
    // 之后：按比例
    amount = min(
        amount0 * _totalSupply / reserve0,
        amount1 * _totalSupply / reserve1
    );
}
```

### 4. 价格预言机（TWAP）

Uniswap V2 内置了时间加权平均价格（TWAP）预言机：

```solidity
function price0CumulativeLast() external view returns (uint);
function price1CumulativeLast() external view returns (uint);
function getReserves() external view returns (uint112, uint112, uint32);
```

计算 TWAP 的方法：

```
TWAP = (priceCumulativeNew - priceCumulativeOld) / (timeNew - timeOld)
```

这个价格是过去一个区块时间内的平均价格，比单点价格更难操控。

---

## Uniswap V2 核心合约结构

```
web3/docs/step1/uniswap-v2/
├── contracts/
│   ├── UniswapV2Factory.sol       # 创建交易对
│   ├── UniswapV2Pair.sol           # 交易对（AMM 核心）
│   ├── UniswapV2Router02.sol      # 路由（用户交互入口）
│   └──/libraries/
│       ├── Math.sol                # 安全数学（溢出检测）
│       ├── UQ112x112.sol           # 定点数运算
│       └── SafeMath.sol            # 安全加/减/乘/除
└── test/
    └── UniswapV2.t.sol             # 完整测试套件
```

### Factory — 创建交易对

```solidity
function createPair(address tokenA, address tokenB) external returns (address pair) {
    // 确保 tokenA < tokenB（统一排序）
    (address token0, address token1) = sortTokens(tokenA, tokenB);

    // 盐：token0 + token1 的 hash
    bytes32 salt = keccak256(abi.encodePacked(token0, token1));

    // CREATE2 部署，确保地址可预测
    pair = address(new UniswapV2Pair{salt: salt}());

    // 初始化
    IUniswapV2Pair(pair).initialize(token0, token1);

    // 记录
    getPair[token0][token1] = pair;
    allPairs.push(pair);
}
```

**为什么用 CREATE2？** 因为可以通过 token0 + token1 计算出 Pair 地址，不需要查询。

### Pair — 核心 AMM

Pair 合约的两个核心函数：

```solidity
// 1. 铸造（添加流动性）
function mint(address to) external lock returns (uint liquidity) {
    (uint112 reserve0, uint112 reserve1,) = getReserves();

    uint balance0 = IERC20(token0).balanceOf(address(this));
    uint amount0 = balance0 - reserve0;
    uint amount1 = balanceOf(token1) - reserve1;

    // 计算份额
    if (_totalSupply == 0) {
        liquidity = sqrt(amount0 * amount1) - MIN_LIQUIDITY;
        _mint(address(0), MIN_LIQUIDITY); // 永久锁定 1000 wei
    } else {
        liquidity = min(
            amount0 * _totalSupply / reserve0,
            amount1 * _totalSupply / reserve1
        );
    }

    _mint(to, liquidity);
}

// 2. 交换（交易代币）
function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external lock {
    require(amount0Out > 0 || amount1Out > 0);
    (uint112 reserve0, uint112 reserve1,) = getReserves();

    require(amount0Out < reserve0 && amount1Out < reserve1);

    // 转移代币
    if (amount0Out > 0) TransferHelper.safeTransfer(token0, to, amount0Out);
    if (amount1Out > 0) TransferHelper.safeTransfer(token1, to, amount1Out);

    // 回调（用于闪电贷）
    if (data.length > 0) IUniswapV2Callee(to).uniswapV2Call(...);

    // 验证 k 不减少
    uint balance0 = IERC20(token0).balanceOf(address(this));
    uint balance1 = IERC20(token1).balanceOf(address(this));
    require(balance0 * balance1 >= reserve0 * reserve1);
}
```

**关键点**：
- `lock` 修饰符防止重入
- `k` 在交换后必须不减少（严格来说，要考虑手续费）
- 支持闪电贷回调

---

## 复刻任务清单

### 阶段 1：理解 Uniswap V2（约 2-3 周）

| 任务 | 产出 |
|---|---|
| 阅读 Uniswap V2 白皮书（不超过 20 页） | 理解 AMM 机制、费用、LP |
| 跑通 Uniswap V2 源码（GitHub 有完整实现） | 能部署本地测试网 |
| 用 Cast 调用 Pair 合约的 getReserves / swap | 理解合约交互 |
| 写一份 Uniswap V2 机制理解文档（自己的话） | 确认真正理解 |
| 用 Foundry 写一个简化版 Pair（不含工厂和路由） | 复刻产出 |

### 阶段 2：深入理解机制（约 1 周）

| 任务 | 产出 |
|---|---|
| 理解为什么需要 Router 合约（Pair 不直接暴露给用户） | 知道 Router 的价值 |
| 理解多跳交易（swapExactTokensForTokens） | 理解路由算法 |
| 理解闪电贷（Flash Swap） | 理解回调机制 |
| 理解 TWAP 预言机计算 | 理解价格平滑机制 |

### 阶段 3：更多 DeFi 协议（约 2-3 周）

在理解了 Uniswap V2 之后，可以扩展到其他协议。

#### Aave — 借贷协议

**核心理念**：存款赚利息，借款付利息，利率由利用率决定。

```
利率模型：
  利率 = 利用率 ^ 系数

利用率 = 借款额 / 存款额

当利用率高 → 利率上升 → 吸引更多存款 → 利用率下降
```

关键概念：
- **健康因子**（Health Factor）：`HF = 抵押额 * 抵押品价格 / 借款额`
- HF < 1 → 触发清算
- **闪电贷**：一笔交易内借款 + 还款，无需抵押

#### Compound — 借贷协议

与 Aave 类似，但设计上更简洁：
- cToken（Compound Token）：存款凭证
- 利率模型公开透明
- 清算机制

#### Curve — 稳定币兑换

**核心理念**：针对同类资产（稳定币、WBTC/WETH）做低滑点交易。

Curve 使用的是混合 AMM：
- 稳定资产：恒定和公式（x + y = k），滑点接近零
- 波动资产：恒定乘积公式（x * y = k）

**Stableswap 数学**：

```
D = A * n * x + D * D / (n * D) + ...  # 复杂的稳定性方程
```

---

## 推荐学习顺序

```
Uniswap V2 (★★★ 必做)
    ↓
Aave V2 / Compound (★★☆ 选做)
    ↓
Curve (★★☆ 选做)
    ↓
Uniswap V3 (★★★ 理解流动性聚集)
    ↓
其他：Yearn、AAVE V3、Balancer
```

---

## 理解到什么程度算过关

| 理解维度 | 达标标准 |
|---|---|
| 数学模型 | 能手推 AMM 公式，知道 Δx 和 Δy 的关系 |
| 代码实现 | 能不看源码，自己写出 Pair 的 swap 函数 |
| LP 机制 | 能解释 LP Token 的铸造和赎回逻辑 |
| 安全边界 | 知道 reentrancy、overflow、front-running 的风险点 |
| 扩展思考 | 能说出 Uniswap V2 和 V3 的核心区别 |

---

## 推荐资料

| 资料 | 类型 | 说明 |
|---|---|---|
| [Uniswap V2 白皮书](https://docs.uniswap.org/whitepaper.pdf) | 论文 | 必读，中文翻译版也很好找 |
| [Uniswap V2 合约源码](https://github.com/Uniswap/v2-core) | 源码 | 核心约 300 行，耐心读完 |
| [Uniswap V2 合约源码（Router）](https://github.com/Uniswap/v2-periphery) | 源码 | 理解路由逻辑 |
| [Finematics 的 DeFi 动画视频](https://www.youtube.com/c/Finematics) | 视频 | 可视化理解 AMM |
| [Paradigm CTF 题解](https://github.com/cyberconnecthq/paradigm-ctf) | 实战 | 通过 CTF 深入理解 |

---

## 复刻时的心态提醒

> **不要急**。理解一个 DeFi 协议比写 10 个没理解的合约更有价值。

每复刻一个协议，产出：
1. 机制理解笔记（用自己的话）
2. 简化版实现（能跑测试）
3. 对比原版的思考笔记

做到这三点，一个协议顶十个。
