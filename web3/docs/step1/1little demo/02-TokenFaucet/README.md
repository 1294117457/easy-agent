# TokenFaucet - 代币水龙头

## 项目概述

一个自定义 ERC20 代币水龙头合约，任何人可以来"领"代币，每个地址限领一次，有领取上限。

## 学习目标

- ERC20 代币标准（transfer、balanceOf、totalSupply）
- `require` 和错误处理
- `mapping` 追踪领取记录
- 继承 OpenZeppelin 的 ERC20 实现
- 用 Foundry 部署代币合约到测试网

---

## 一步步实现

### Step 1：初始化项目

```bash
forge init token-faucet
cd token-faucet
```

安装 OpenZeppelin 库：

```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.0.0 --no-commit
```

### Step 2：设计合约

**合约需要两个功能：**

1. **铸币**：合约持有初始发行的代币
2. **领取**：每个地址只能领取一次，每次领取固定数量

```
┌─────────────────────────────────────────┐
│              TokenFaucet 合约              │
├─────────────────────────────────────────┤
│                                         │
│  ERC20 Token（FaucetToken）              │
│    - totalSupply = 1000000 * 10^18     │
│    - 所有代币预铸给合约本身               │
│                                         │
│  Faucet 功能：                           │
│    - claim(): 领取 1000 Token            │
│    - claimed[address]: mapping 追踪     │
│    - 每人限领一次                        │
│                                         │
└─────────────────────────────────────────┘
```

### Step 3：编写合约

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FaucetToken is ERC20 {
    uint256 public constant CLAIM_AMOUNT = 1000 * 10 ** 18;
    uint256 public constant MAX_CLAIMS = 1000; // 最多 1000 人领取

    uint256 public claimedCount;
    mapping(address => bool) public claimed;

    constructor() ERC20("Faucet Token", "FCT") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    function claim() external {
        require(!claimed[msg.sender], "Already claimed");
        require(claimedCount < MAX_CLAIMS, "All tokens claimed");

        claimed[msg.sender] = true;
        claimedCount += 1;

        _transfer(address(this), msg.sender, CLAIM_AMOUNT);
    }

    // 领取余额（方便测试）
    function getBalance() external view returns (uint256) {
        return balanceOf(msg.sender);
    }
}
```

**关键设计解释：**

| 元素 | 说明 |
|---|---|
| `import "@openzeppelin/contracts/token/ERC20/ERC20.sol"` | 继承 OpenZeppelin 的 ERC20 |
| `_mint(msg.sender, 1_000_000 * 10 ** decimals())` | 构造函数中预铸所有代币给部署者 |
| `decimals()` | OpenZeppelin ERC20 提供的函数，默认返回 18 |
| `claimed[msg.sender]` | mapping 追踪每个地址是否已领取 |
| `_transfer(address(this), msg.sender, CLAIM_AMOUNT)` | 从合约余额转给调用者 |

### Step 4：编写测试

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {FaucetToken} from "../src/FaucetToken.sol";

contract FaucetTokenTest is Test {
    FaucetToken public faucet;

    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);

    function setUp() public {
        faucet = new FaucetToken();
    }

    // ========== 代币基本信息测试 ==========

    function test_tokenMetadata() public {
        assertEq(faucet.name(), "Faucet Token");
        assertEq(faucet.symbol(), "FCT");
        assertEq(faucet.decimals(), 18);
    }

    function test_totalSupply() public {
        uint256 expectedSupply = 1_000_000 * 10 ** 18;
        assertEq(faucet.totalSupply(), expectedSupply);
    }

    function test_deployerHoldsAllSupply() public {
        assertEq(faucet.balanceOf(address(this)), faucet.totalSupply());
    }

    // ========== 领取功能测试 ==========

    function test_firstClaim() public {
        vm.prank(user1); // 模拟 user1 调用
        faucet.claim();

        uint256 claimAmount = faucet.CLAIM_AMOUNT();
        assertEq(faucet.balanceOf(user1), claimAmount);
        assertTrue(faucet.claimed(user1));
    }

    function test_secondClaim_reverts() public {
        vm.startPrank(user1);
        faucet.claim();

        vm.expectRevert("Already claimed");
        faucet.claim();
        vm.stopPrank();
    }

    function test_claimAmountCorrect() public {
        vm.prank(user1);
        faucet.claim();

        uint256 expected = 1000 * 10 ** 18;
        assertEq(faucet.balanceOf(user1), expected);
    }

    // ========== 多人领取测试 ==========

    function test_multipleUsersCanClaim() public {
        vm.prank(user1);
        faucet.claim();

        vm.prank(user2);
        faucet.claim();

        vm.prank(user3);
        faucet.claim();

        uint256 expectedAmount = 1000 * 10 ** 18;
        assertEq(faucet.balanceOf(user1), expectedAmount);
        assertEq(faucet.balanceOf(user2), expectedAmount);
        assertEq(faucet.balanceOf(user3), expectedAmount);
        assertEq(faucet.claimedCount(), 3);
    }

    // ========== 边界测试 ==========

    function test_unclaimedAddressCanClaim() public {
        // user1 领取
        vm.prank(user1);
        faucet.claim();

        // user2 之前没领取过，可以领
        vm.prank(user2);
        faucet.claim();

        assertEq(faucet.balanceOf(user2), faucet.CLAIM_AMOUNT());
    }

    function test_transferAfterClaim() public {
        vm.prank(user1);
        faucet.claim();

        // user1 转给 user2
        vm.prank(user1);
        faucet.transfer(user2, 500 * 10 ** 18);

        assertEq(faucet.balanceOf(user1), 500 * 10 ** 18);
        assertEq(faucet.balanceOf(user2), 500 * 10 ** 18);
        // claimed 状态不变
        assertTrue(faucet.claimed(user1));
    }
}
```

**测试要点：**

| 测试用例 | 验证什么 |
|---|---|
| `test_secondClaim_reverts` | 已领取的地址无法再次领取 |
| `test_multipleUsersCanClaim` | 不同地址互不影响 |
| `test_transferAfterClaim` | 领取后转账不影响 claimed 状态 |

运行测试：

```bash
forge test -vv
```

### Step 5：部署到 Sepolia

```bash
source .env

forge create --rpc-url $SEPOLIA_RPC_URL \
             --private-key $PRIVATE_KEY \
             src/FaucetToken.sol:FaucetToken
```

### Step 6：用 Cast 验证

```bash
# 查询合约余额（即总供应量）
cast call <CONTRACT_ADDRESS> "balanceOf(address)" <YOUR_ADDRESS> \
    --rpc-url $SEPOLIA_RPC_URL

# 领取代币
cast send <CONTRACT_ADDRESS> "claim()" \
    --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL

# 再次查询余额（应该增加了 1000 * 10^18）
cast call <CONTRACT_ADDRESS> "balanceOf(address)" <YOUR_ADDRESS> \
    --rpc-url $SEPOLIA_RPC_URL

# 检查是否已领取
cast call <CONTRACT_ADDRESS> "claimed(address)" <YOUR_ADDRESS> \
    --rpc-url $SEPOLIA_RPC_URL

# 尝试再次领取（应该失败）
cast send <CONTRACT_ADDRESS> "claim()" \
    --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL
```

---

## 验收标准

```
✅ 代币名称、符号、小数位正确
✅ 总供应量 = 1000000 * 10^18
✅ 部署者持有全部代币
✅ 第一次 claim 成功，余额增加 1000 Token
✅ 第二次 claim 失败（revert "Already claimed"）
✅ 不同地址互不影响
✅ 部署到 Sepolia 测试网
✅ 用 Cast 验证链上行为
✅ forge test 全部通过，覆盖率 100%
```

---

## 扩展挑战

| 挑战 | 提示 |
|---|---|
| 加一个 `claimTime` 追踪领取时间 | 领取时记录 `claimTime[msg.sender] = block.timestamp` |
| 加冷却时间（24 小时后才能再领） | `require(block.timestamp >= claimTime[msg.sender] + 24 hours)` |
| 加领取事件 `Claimed(address user, uint256 amount)` | 触发事件方便用 Cast 监听 |
| 加一个管理员可以设置领取金额 | 结合 `Ownable` 合约 |

---

## 目录结构

```
02-TokenFaucet/
├── README.md                    ← 本文件
├── IMPLEMENTATION.md            ← 分步实现指南
└── KNOWLEDGE.md                 ← 相关知识补充
```
