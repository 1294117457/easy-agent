# VendingMachine - 相关知识补充

## 1. payable 函数与 ETH 操作

### 什么是 payable

`payable` 关键字表示函数可以接收 ETH。

```solidity
// 普通函数不能接收 ETH
function normalFunc() public { }

// payable 函数可以接收 ETH
function payFunc() public payable { }

// 地址也可以是 payable
address public normalAddr;
payable(address) public payAddr;
```

### msg.value

```solidity
function deposit() public payable {
    uint256 amount = msg.value;  // 收到的 ETH 数量（以 wei 为单位）
    console.log("Received:", amount);
}
```

### address(this).balance

```solidity
contract MyContract {
    function getBalance() public view returns (uint256) {
        return address(this).balance;  // 合约当前持有的 ETH
    }

    function getSenderBalance() public view returns (uint256) {
        return msg.sender.balance;     // 调用者的 ETH 余额
    }
}
```

### ETH 单位换算

```solidity
1 wei                           // 最小单位
1 gwei  = 10^9 wei              // gas 价格常用单位
1 ether = 10^18 wei             // 常用单位
1_000_000_000_000_000_000 wei  // 1 ether
```

```solidity
// Solidity 中的 ether 单位
1 wei
1 szabo    = 10^12 wei          // 0.000001 ether
1 finney   = 10^15 wei          // 0.001 ether
1 ether
```

### 转 ETH 的三种方式

| 方式 | 说明 | 风险 |
|---|---|---|
| `transfer()` |2300 gas，失败自动 revert | 可能因 gas 变化失败 |
| `send()` | 2300 gas，需要检查返回值 | 需手动检查返回值 |
| `call{value:}("")` | 推荐，无 gas 限制 | 需手动检查返回值，需防重入 |

```solidity
address payable recipient = payable(0x...);

// 方式 1: transfer（不推荐）
recipient.transfer(1 ether);

// 方式 2: send（不推荐）
bool success = recipient.send(1 ether);
require(success, "Send failed");

// 方式 3: call（推荐）
(bool success, ) = recipient.call{value: 1 ether}("");
require(success, "Transfer failed");
```

> **为什么用 call**：它会传递所有可用的 gas，不受 2300 gas 限制。当接收方是合约需要执行复杂逻辑时，transfer/send 会失败。

---

## 2. ReentrancyGuard 详解

### 什么是重入攻击

攻击者创建一个恶意合约，在收到转账时回调原合约，重复触发提款。

```
正常合约：                          恶意合约：
withdraw() {                       fallback() {
    require(balance >= amount);         withdraw();  ← 再次调用
    msg.sender.call{value: amount}();       }
    balance -= amount;                   }
}
                                    问题：
                                    转账后才扣 balance，
                                    中间被回调还能再转
```

### ReentrancyGuard 的实现

```solidity
abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    constructor() {
        _status = NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status == NOT_ENTERED, "ReentrancyGuard: reentrant call");
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }
}
```

### 使用方式

```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MyContract is ReentrancyGuard {
    function withdraw() external nonReentrant {
        uint256 balance = balances[msg.sender];
        require(balance > 0);

        (bool success, ) = msg.sender.call{value: balance}("");
        require(success);

        balances[msg.sender] = 0;  // CEI: 先转账后清零（实际应反过来）
    }
}
```

> **重要**：即使有 ReentrancyGuard，也应该遵循 CEI 模式。先更新状态，再执行外部调用。

---

## 3. CEI 模式（Checks-Effects-Interactions）

CEI 是一种防御编程模式：

```
Checks  → 检查前置条件
  ↓
Effects → 更新合约状态
  ↓
Interactions → 与外部合约/地址交互
```

### 错误示例（违反 CEI）

```solidity
function withdraw() external {
    uint256 balance = balances[msg.sender];  // Effects (读取)

    require(balance > 0);                      // Checks

    (bool success, ) = msg.sender.call{value: balance}(""); // Interactions
    require(success);

    balances[msg.sender] = 0;                   // Effects (写入) ← 太晚了！
}
```

### 正确示例（遵循 CEI）

```solidity
function withdraw() external {
    uint256 balance = balances[msg.sender];      // Effects (读取)

    require(balance > 0);                       // Checks

    balances[msg.sender] = 0;                   // Effects (写入) ← 先更新

    (bool success, ) = msg.sender.call{value: balance}(""); // Interactions
    require(success);
}
```

---

## 4. _mint / _burn / _transfer

OpenZeppelin ERC20 提供了一些内部函数：

```solidity
// 铸造（增加 totalSupply 和 recipient 余额）
_mint(address to, uint256 amount);

// 销毁（减少 totalSupply 和 holder 余额）
_burn(address from, uint256 amount);

// 转账（在两个地址之间移动代币）
_transfer(address from, address to, uint256 amount);
```

### 使用场景

```solidity
// 场景 1: 合约铸造新代币
function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);
}

// 场景 2: 用户销毁自己的代币
function burn(uint256 amount) external {
    _burn(msg.sender, amount);
}

// 场景 3: 从合约转账给用户
function transferFromContract(address to, uint256 amount) external onlyOwner {
    _transfer(address(this), to, amount);
}
```

### 权限控制

`_mint` 和 `_burn` 默认没有权限控制，需要自己加：

```solidity
// 错误：任何人都可以铸造
contract BadToken is ERC20 {
    function mint(address to, uint256 amount) external {
        _mint(to, amount);  // 没有权限检查！
    }
}

// 正确：只有合约持有者可以铸造
contract GoodToken is ERC20, Ownable {
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
```

---

## 5. Ownable 合约详解

### 基本用法

```solidity
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyContract is Ownable {
    constructor() Ownable(msg.sender) {}

    function restrictedAction() external onlyOwner {
        // ...
    }
}
```

### onlyOwner 修饰符

```solidity
modifier onlyOwner() {
    require(owner() == msg.sender, "Ownable: caller is not the owner");
    _;
}
```

### Ownable 的内部机制

```solidity
abstract contract Ownable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        _transferOwnership(initialOwner);
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
```

---

## 6. Fallback 和 Receive 函数

当合约收到 ETH 时，会触发：

```solidity
// 触发条件：合约收到 ETH 且调用了不存在的函数
fallback() external [payable]

// 触发条件：合约收到 ETH 且 calldata 为空
receive() external payable
```

```solidity
contract FallbackExample {
    event Received(address sender, uint256 value);

    // 如果有 receive，就用它
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    // 否则用 fallback
    fallback() external payable {
        emit Received(msg.sender, msg.value);
    }
}
```

**优先级**：
1. 函数签名匹配 → 调用对应函数
2. calldata 为空 → 调用 `receive()`
3. 其他 → 调用 `fallback()`

---

## 推荐阅读

- [OpenZeppelin - ReentrancyGuard](https://docs.openzeppelin.com/contracts/5.x/api/utils#ReentrancyGuard)
- [OpenZeppelin - Ownable](https://docs.openzevpelin.com/contracts/5.x/api/access#Ownable)
- [Solidity by Example - Re-entrancy](https://solidity-by-example.org/hacks/re-entrancy/)
- [Cyfrin Course - Re-entrancy](https://updraft.cyfrin.io/)
