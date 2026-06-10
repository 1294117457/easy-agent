# SimpleAuction - 相关知识补充

## 1. 时间与区块

### block.timestamp

```solidity
contract TimeExample {
    function getCurrentTime() public view returns (uint256) {
        return block.timestamp;  // 当前区块的时间戳（秒）
    }

    function isAfter(uint256 targetTime) external view returns (bool) {
        return block.timestamp > targetTime;
    }
}
```

**重要特性**：

```
block.timestamp 由矿工/验证者设置
允许的范围：上一个区块时间 ± 15 秒（大约）
实际精度：15 秒左右，不是精确的 1 秒
```

### 时间单位

```solidity
// Solidity 内置时间单位（转换为秒）
seconds      = 1
minutes      = 60
hours        = 3600
days         = 86400
weeks        = 604800

// 示例
uint256 oneHour = 1 hours;        // 3600
uint256 oneDay = 1 days;           // 86400
uint256 oneWeek = 1 weeks;         // 604800

// 时间运算
uint256 start = block.timestamp;
uint256 end = start + 7 days;     // 7 天后
uint256 later = end + 2 hours;     // 再加 2 小时
```

### vm.warp（测试中的时间控制）

```solidity
function test_timeBased() public {
    uint256 startTime = block.timestamp;

    // 快进 1 小时
    vm.warp(block.timestamp + 1 hours);

    // 验证时间已变化
    assertGt(block.timestamp, startTime);
}
```

### block.number

```solidity
contract BlockExample {
    function getCurrentBlock() public view returns (uint256) {
        return block.number;  // 当前区块高度
    }

    function estimateBlocksInDays(uint256 days) public pure returns (uint256) {
        return days * 7200 / 12;  // 假设 12 秒一个区块
    }
}
```

---

## 2. 状态机设计

### 什么是状态机

状态机是一种设计模式，合约只能处于有限的"状态"之一，某些操作只能在特定状态下执行。

### 使用 enum 定义状态

```solidity
enum AuctionState {
    Pending,
    Active,
    Ended,
    Canceled
}

contract StateMachine {
    AuctionState public state = AuctionState.Pending;

    function startAuction() external {
        require(state == AuctionState.Pending, "Wrong state");
        state = AuctionState.Active;
    }

    function endAuction() external {
        require(state == AuctionState.Active, "Wrong state");
        state = AuctionState.Ended;
    }

    function cancel() external {
        require(state == AuctionState.Pending, "Cannot cancel");
        state = AuctionState.Canceled;
    }
}
```

### 状态转换图

```
┌─────────┐
│ Pending │ ← 初始状态
└────┬────┘
     │
     ▼ startAuction()
┌─────────┐
│ Active  │ ← 可以投标
└────┬────┘
     │
     ▼ endAuction() 或 时间到期
┌─────────┐
│  Ended  │
└─────────┘
     │
     ▼ cancel()
┌───────────┐
│ Canceled  │
└───────────┘
```

### 状态转换规则

```
1. 每次状态转换都要检查前置条件
2. 状态转换后要发出事件（方便追踪）
3. 状态变量使用 enum 更清晰
4. 某些操作只在特定状态下有效
```

---

## 3. ETH 存取模式

### 模式 1：直接退款

```solidity
// 不推荐：可能触发重入
function buy() external payable {
    uint256 refund = balance[msg.sender] - msg.value;
    balance[msg.sender] = msg.value;
    if (refund > 0) {
        payable(msg.sender).transfer(refund);  // 直接退款
    }
}
```

### 模式 2：待取回（Pull over Push）

```solidity
// 推荐：使用 pull 模式
mapping(address => uint256) pendingReturns;

function bid() external payable {
    // 记录之前的出价
    if (highestBid > 0) {
        pendingReturns[highestBidder] += highestBid;
    }
    highestBid = msg.value;
    highestBidder = msg.sender;
}

function withdraw() external {
    uint256 amount = pendingReturns[msg.sender];
    require(amount > 0);

    pendingReturns[msg.sender] = 0;  // 先清零
    payable(msg.sender).transfer(amount);  // 再转账
}
```

**Pull vs Push**：

| 模式 | 优点 | 缺点 |
|---|---|---|
| Push（直接退款） | 用户体验好 | 可能触发重入，gas 不可预测 |
| Pull（待取回） | 安全，可预测 gas | 需要用户主动操作 |

> **最佳实践**：尽可能使用 Pull 模式（pendingReturns），避免批量转账。

### 模式 3：CEI + ReentrancyGuard

```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

function withdraw() external nonReentrant {
    uint256 amount = pendingReturns[msg.sender];
    require(amount > 0);

    pendingReturns[msg.sender] = 0;  // CEI: 先更新状态

    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
}
```

---

## 4. address 类型深入

### payable 地址

```solidity
address public normalAddr;
payable(address) public payableAddr;

// 转换
payableAddr = payable(normalAddr);

// 发送 ETH
payableAddr.transfer(1 ether);
payableAddr.send(1 ether);
(bool success, ) = payableAddr.call{value: 1 ether}("");
```

### 地址属性

```solidity
contract AddressDemo {
    function checkAddress(address addr) external view returns (
        uint256 balance,
        uint256 codeSize,
        bool isContract
    ) {
        balance = addr.balance;
        codeSize = addr.code.length;  // 有代码 = 是合约
        isContract = addr.code.length > 0;
    }
}
```

### 判断合约 vs EOA

```solidity
function isContract(address addr) public view returns (bool) {
    return addr.code.length > 0;
}

function bid() external payable {
    require(!isContract(msg.sender), "Contracts cannot bid");
    // ...
}
```

---

## 5. 回退出价机制（Proxy Bidding）

### 什么是代理出价

用户设置一个"最高出价"，合约自动帮用户竞拍，直到达到这个价格。

### 简单实现

```solidity
contract ProxyAuction {
    mapping(address => uint256) public maxBid;
    mapping(address => uint256) public currentBid;

    function setMaxBid() external payable {
        require(msg.value > currentBid[msg.sender]);
        maxBid[msg.sender] = msg.value;
    }

    function placeBid(address bidder, uint256 amount) external {
        require(amount > currentBid[bidder]);
        require(amount <= maxBid[bidder]);

        // 退款旧出价
        if (currentBid[bidder] > 0) {
            pendingReturns[bidder] += currentBid[bidder];
        }

        currentBid[bidder] = amount;
        // 更新最高出价...
    }
}
```

---

## 6. 常见拍卖类型

### English Auction（英式拍卖）

```
从低价开始，买家竞争出价
最高出价者获胜
→ 本项目的模式
```

### Dutch Auction（荷兰式拍卖）

```
从高价开始，价格随时间下降
第一个接受价格的买家获胜
→ Uniswap V2 的定价机制类似
```

### Sealed-Bid Auction（密封拍卖）

```
买家在截止时间前提交出价（不可见）
截止后统一开标
最高出价者获胜
→ 需要 commit-reveal 方案在链上实现
```

### Vickrey Auction（维克瑞拍卖）

```
密封拍卖的一种
最高出价者获胜，但支付第二高的价格
→ 激励买家诚实出价
```

---

## 推荐阅读

- [Solidity by Example - Auction](https://solidity-by-example.org/app/english-auction/)
- [OpenZeppelin - ReentrancyGuard](https://docs.openzeppelin.com/contracts/5.x/api/utils#ReentrancyGuard)
- [Cyfrin Course - Auction Contract](https://updraft.cyfrin.io/)
