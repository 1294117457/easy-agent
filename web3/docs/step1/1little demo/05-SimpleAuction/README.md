# SimpleAuction - 简单拍卖合约

## 项目概述

一个链上拍卖合约：卖家发起拍卖设定截止时间，买家出价 ETH，截止后最高出价者赢得物品，其他人可以取回押金。

## 学习目标

- 时间锁（`block.timestamp`）的使用
- 状态机设计（`Pending` → `Active` → `Ended`）
- 处理并发出价（防止同一区块内重入）
- 理解为什么区块链上的"公平"很难实现
- 处理 ETH 的存取（押金模式）

---

## 一步步实现

### Step 1：初始化项目

```bash
forge init simple-auction
cd simple-auction
```

### Step 2：设计合约

**状态机设计：**

```
┌──────────────────────────────────────────────────┐
│                 SimpleAuction 状态机                │
├──────────────────────────────────────────────────┤
│                                                  │
│   ┌─────────┐    createAuction    ┌───────────┐ │
│   │ PENDING │ ──────────────────▶  │  ACTIVE   │ │
│   └─────────┘                      └───────────┘ │
│                                          │        │
│                           auctionEndTime         │
│                              到达                  │
│                                          ▼        │
│                                   ┌───────────┐  │
│                                   │   ENDED   │  │
│                                   └───────────┘  │
│                                          │        │
│                         买家取回押金 / 赢家领取物品  │
│                                          ▼        │
│                                   ┌───────────┐  │
│                                   │ COMPLETED │  │
│                                   └───────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

**核心变量：**

| 变量 | 说明 |
|---|---|
| `beneficiary` | 卖家地址，最终获得拍卖收入 |
| `auctionStartTime` | 拍卖开始时间 |
| `auctionEndTime` | 拍卖结束时间 |
| `highestBidder` | 当前最高出价者 |
| `highestBid` | 当前最高出价 |
| `bids` | 记录每个地址的出价金额 |

### Step 3：编写合约

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SimpleAuction {
    // ============ 状态变量 ============
    address public beneficiary;      // 卖家（受益人）
    uint256 public auctionStartTime;
    uint256 public auctionEndTime;   // 结束时间戳

    address public highestBidder;    // 当前最高出价者
    uint256 public highestBid;       // 当前最高出价

    // 记录每个地址的出价金额（地址 -> 出价金额）
    mapping(address => uint256) public pendingReturns;

    // ============ 状态枚举 ============
    enum AuctionState {
        PENDING,
        ACTIVE,
        ENDED,
        COMPLETED
    }

    // ============ 事件 ============
    event AuctionCreated(uint256 endTime);
    event HighestBidIncreased(address bidder, uint256 amount);
    event AuctionEnded(address winner, uint256 amount);
    event BidWithdrawn(address bidder, uint256 amount);

    // ============ 构造函数 ============
    constructor(
        uint256 _biddingTime,  // 拍卖持续时间（秒）
        address _beneficiary
    ) {
        require(_biddingTime > 0, "Bidding time must be positive");
        beneficiary = _beneficiary;
        auctionStartTime = block.timestamp;
        auctionEndTime = block.timestamp + _biddingTime;
        highestBid = 0;

        emit AuctionCreated(auctionEndTime);
    }

    // ============ 核心函数 ============

    /// 出价（如果出价更高，则成为新的最高出价者）
    function bid() external payable {
        require(block.timestamp >= auctionStartTime, "Auction not started");
        require(block.timestamp < auctionEndTime, "Auction already ended");
        require(msg.value > highestBid, "Bid must be higher than current highest");

        // 记录之前的最高出价者可以取回的金额
        if (highestBidder != address(0)) {
            pendingReturns[highestBidder] += highestBid;
        }

        highestBid = msg.value;
        highestBidder = msg.sender;

        emit HighestBidIncreased(msg.sender, msg.value);
    }

    /// 结束拍卖（只能由受益人调用，在拍卖结束后）
    function endAuction() external {
        require(block.timestamp >= auctionEndTime, "Auction not yet ended");
        require(msg.sender == beneficiary, "Only beneficiary can end");

        // 将 ETH 转给受益人
        uint256 amount = highestBid;
        highestBid = 0;

        if (amount > 0) {
            (bool success, ) = beneficiary.call{value: amount}("");
            require(success, "Transfer to beneficiary failed");
            emit AuctionEnded(highestBidder, amount);
        }
    }

    /// 取回出价（拍卖结束后或被超越时调用）
    function withdraw() external returns (bool) {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "No funds to withdraw");

        // 先清零（CEI 模式：先更新状态）
        pendingReturns[msg.sender] = 0;

        // 再转 ETH
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdraw failed");

        emit BidWithdrawn(msg.sender, amount);
        return success;
    }

    /// 获取可取回金额
    function getPendingReturn(address bidder) external view returns (uint256) {
        return pendingReturns[bidder];
    }

    /// 查询拍卖状态
    function getAuctionState() external view returns (AuctionState) {
        if (block.timestamp < auctionEndTime) {
            return AuctionState.ACTIVE;
        } else if (highestBid > 0) {
            return AuctionState.ENDED;
        } else {
            return AuctionState.PENDING;
        }
    }

    /// 查询合约余额（调试用）
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
```

**关键设计解释：**

| 元素 | 说明 |
|---|---|
| `block.timestamp` | 当前区块的时间戳，矿工可以在小范围内影响 |
| `pendingReturns[address]` | 记录每个地址可取回的金额（被超越的出价） |
| `CEI 模式 in withdraw()` | 先清零 pendingReturns，再转 ETH |
| 押金模式 | 不直接退款，而是记录到 pendingReturns，让用户主动取回 |

### Step 4：编写测试

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {SimpleAuction} from "../src/SimpleAuction.sol";

contract SimpleAuctionTest is Test {
    SimpleAuction public auction;
    address public beneficiary = makeAddr("beneficiary");
    address public bidder1 = makeAddr("bidder1");
    address public bidder2 = makeAddr("bidder2");
    address public bidder3 = makeAddr("bidder3");

    uint256 constant BIDDING_TIME = 1 hours;

    function setUp() public {
        auction = new SimpleAuction(BIDDING_TIME, beneficiary);
    }

    // ========== 基本信息测试 ==========

    function test_auctionInitialized() public {
        assertEq(auction.beneficiary(), beneficiary);
        assertEq(auction.highestBidder(), address(0));
        assertEq(auction.highestBid(), 0);
        assertEq(auction.getAuctionState(), SimpleAuction.AuctionState.ACTIVE);
    }

    // ========== 出价测试 ==========

    function test_firstBid() public {
        vm.deal(bidder1, 10 ether);

        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        assertEq(auction.highestBidder(), bidder1);
        assertEq(auction.highestBid(), 1 ether);
    }

    function test_higherBidBecomesHighest() public {
        vm.deal(bidder1, 10 ether);
        vm.deal(bidder2, 10 ether);

        // bidder1 出价 1 ether
        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        // bidder2 出价 2 ether，成为新的最高
        vm.prank(bidder2);
        auction.bid{value: 2 ether}();

        assertEq(auction.highestBidder(), bidder2);
        assertEq(auction.highestBid(), 2 ether);

        // bidder1 可以取回 1 ether
        assertEq(auction.getPendingReturn(bidder1), 1 ether);
    }

    function test_lowerBidReverts() public {
        vm.deal(bidder1, 10 ether);
        vm.deal(bidder2, 10 ether);

        vm.prank(bidder1);
        auction.bid{value: 2 ether}();

        vm.prank(bidder2);
        vm.expectRevert("Bid must be higher than current highest");
        auction.bid{value: 1 ether}();
    }

    function test_equalBidReverts() public {
        vm.deal(bidder1, 10 ether);
        vm.deal(bidder2, 10 ether);

        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        vm.prank(bidder2);
        vm.expectRevert("Bid must be higher than current highest");
        auction.bid{value: 1 ether}();
    }

    // ========== 连续出价测试 ==========

    function test_multipleBidsFromSameAddress() public {
        vm.deal(bidder1, 10 ether);

        // 第一次出价
        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        // 第二次出价（必须更高）
        vm.prank(bidder1);
        auction.bid{value: 2 ether}();

        assertEq(auction.highestBid(), 2 ether);
        assertEq(auction.highestBidder(), bidder1);
        // pendingReturns 不变，因为是同一个地址
        assertEq(auction.getPendingReturn(bidder1), 0);
    }

    function test_complexBiddingSequence() public {
        vm.deal(bidder1, 20 ether);
        vm.deal(bidder2, 20 ether);
        vm.deal(bidder3, 20 ether);

        // bidder1: 1 ether
        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        // bidder2: 2 ether (bidder1 被超越)
        vm.prank(bidder2);
        auction.bid{value: 2 ether}();

        // bidder3: 3 ether (bidder2 被超越)
        vm.prank(bidder3);
        auction.bid{value: 3 ether}();

        // bidder1: 4 ether (bidder3 被超越)
        vm.prank(bidder1);
        auction.bid{value: 4 ether}();

        // 最终状态
        assertEq(auction.highestBidder(), bidder1);
        assertEq(auction.highestBid(), 4 ether);
        assertEq(auction.getPendingReturn(bidder2), 2 ether);
        assertEq(auction.getPendingReturn(bidder3), 3 ether);
        assertEq(auction.getPendingReturn(bidder1), 0);
    }

    // ========== 取回押金测试 ==========

    function test_withdrawAfterBeingOutbid() public {
        vm.deal(bidder1, 10 ether);
        vm.deal(bidder2, 10 ether);

        uint256 initialBalance = bidder1.balance;

        // bidder1 出价 1 ether
        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        // bidder2 出价 2 ether，bidder1 被超越
        vm.prank(bidder2);
        auction.bid{value: 2 ether}();

        // bidder1 取回 1 ether
        vm.prank(bidder1);
        auction.withdraw();

        assertEq(bidder1.balance, initialBalance);
        assertEq(auction.getPendingReturn(bidder1), 0);
    }

    function test_withdrawZero_reverts() public {
        vm.prank(bidder1);
        vm.expectRevert("No funds to withdraw");
        auction.withdraw();
    }

    // ========== 拍卖结束测试 ==========

    function test_cannotBidAfterEnd() public {
        vm.deal(bidder1, 10 ether);

        // 快进到拍卖结束
        vm.warp(auction.auctionEndTime() + 1);

        vm.prank(bidder1);
        vm.expectRevert("Auction already ended");
        auction.bid{value: 1 ether}();
    }

    function test_beneficiaryCanEndAuction() public {
        vm.deal(bidder1, 10 ether);

        vm.prank(bidder1);
        auction.bid{value: 5 ether}();

        // 快进到拍卖结束
        vm.warp(auction.auctionEndTime() + 1);

        uint256 beneficiaryBalanceBefore = beneficiary.balance;

        vm.prank(beneficiary);
        auction.endAuction();

        assertEq(beneficiary.balance, beneficiaryBalanceBefore + 5 ether);
    }

    function test_nonBeneficiaryCannotEndAuction() public {
        vm.deal(bidder1, 10 ether);

        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        vm.warp(auction.auctionEndTime() + 1);

        vm.prank(bidder1);
        vm.expectRevert("Only beneficiary can end");
        auction.endAuction();
    }

    // ========== 合约余额测试 ==========

    function test_contractBalanceAfterBids() public {
        vm.deal(bidder1, 10 ether);
        vm.deal(bidder2, 10 ether);

        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        vm.prank(bidder2);
        auction.bid{value: 2 ether}();

        // 合约余额 = 2 ether（最高的出价）
        assertEq(address(auction).balance, 2 ether);
    }

    // ========== 边界测试 ==========

    function test_verySmallBidIncrement() public {
        vm.deal(bidder1, 100 ether);
        vm.deal(bidder2, 100 ether);

        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        // 只要比当前高就行
        vm.prank(bidder2);
        auction.bid{value: 1 ether + 1 wei}();

        assertEq(auction.highestBidder(), bidder2);
    }
}
```

运行测试：

```bash
forge test -vv
```

### Step 5：部署到 Sepolia

```bash
source .env

# 创建 1 小时拍卖，beneficiary 是收款地址
forge create --rpc-url $SEPOLIA_RPC_URL \
             --private-key $PRIVATE_KEY \
             src/SimpleAuction.sol:SimpleAuction \
             --constructor-args 3600 $BENEFICIARY_ADDRESS
```

### Step 6：用 Cast 验证

```bash
# 查询当前最高出价
cast call <CONTRACT_ADDRESS> "highestBid()" --rpc-url $SEPOLIA_RPC_URL

# 查询受益人
cast call <CONTRACT_ADDRESS> "beneficiary()" --rpc-url $SEPOLIA_RPC_URL

# 出价 0.1 ETH
cast send <CONTRACT_ADDRESS> "bid()" \
    --value 0.1ether \
    --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL

# 查询可取回金额
cast call <CONTRACT_ADDRESS> "getPendingReturn(address)" $BIDDER_ADDRESS \
    --rpc-url $SEPOLIA_RPC_URL

# 取回押金
cast send <CONTRACT_ADDRESS> "withdraw()" \
    --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL

# 查询合约余额
cast balance <CONTRACT_ADDRESS> --rpc-url $SEPOLIA_RPC_URL
```

---

## 验收标准

```
✅ 第一个出价者成为最高出价者
✅ 更高的出价取代当前最高
✅ 更低的出价被拒绝
✅ 被超越的出价者可以取回押金
✅ 拍卖结束后无法出价
✅ 只有受益人可以在拍卖结束后结束拍卖
✅ 拍卖结束后受益人获得 ETH
✅ 非受益人不能结束拍卖
✅ 合约余额正确（只保留最高出价）
✅ forge test 全部通过，覆盖率 100%
```

---

## 区块链上"公平"的难题

这个项目揭示了区块链上"公平"的难题：

```
问题 1: MEV（矿工可提取价值）
  矿工可以看到所有人的出价
  可以把自己的出价排在最后，确保自己赢
  → 解决方案：commit-reveal 方案（但本项目未实现）

问题 2: 时间戳操纵
  矿工可以在小范围内调整 block.timestamp
  可以在拍卖最后一秒追加出价
  → 解决方案：设置比预期更早的结束时间

问题 3: 前端运行
  即使你不是矿工，也可以监听内存池
  看到别人出价后，快速提交更高的出价
  → 解决方案：Flashbots 私有交易
```

---

## 扩展挑战

| 挑战 | 提示 |
|---|---|
| 加时间延长机制 | 最后 5 分钟出价，延长 5 分钟 |
| 加代理出价 | 设置最高出价，让合约自动竞价 |
| 加 NFT 拍卖 | 将 ERC721 作为拍品 |
| 加 Dutch Auction | 价格随时间递减的拍卖 |

---

## 目录结构

```
05-SimpleAuction/
├── README.md                    ← 本文件
├── IMPLEMENTATION.md            ← 分步实现指南
└── KNOWLEDGE.md                 ← 相关知识补充
```
