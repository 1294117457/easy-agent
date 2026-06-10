# VendingMachine - 自动售卖机

## 项目概述

一个 ETH 和 ERC20 代币双向兑换的合约。用户存入 ETH 获得代币，或者销毁代币换回 ETH。

## 学习目标

- ETH 和 ERC20 的双向转换
- `payable` 函数和 `address(this).balance`
- 重入攻击风险的初步认识（为什么需要 ReentrancyGuard）
- 使用 OpenZeppelin 的安全库
- 完整的边界测试覆盖

---

## 一步步实现

### Step 1：初始化项目

```bash
forge init vending-machine
cd vending-machine
forge install OpenZeppelin/openzeppelin-contracts@v5.0.0 --no-commit
```

### Step 2：设计合约

**核心功能：**

```
┌─────────────────────────────────────────┐
│           VendingMachine 合约             │
├─────────────────────────────────────────┤
│                                         │
│  管理员（owner）：                        │
│    - 设置兑换汇率                         │
│    - 提取合约中的 ETH                     │
│                                         │
│  用户：                                 │
│    - depositETH()  存 ETH，获得代币       │
│    - withdrawTokens() 销毁代币，换回 ETH  │
│                                         │
│  汇率：1 ETH = 1000 Token                │
│                                         │
└─────────────────────────────────────────┘
```

**安全考虑：**
- 需要防止重入攻击（虽然本合约逻辑较简单）
- 汇率只能被 owner 修改
- 用户销毁代币时检查 ETH 余额是否足够

### Step 3：编写合约

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract VendingMachineToken is ERC20, Ownable {
    uint256 public constant RATE = 1000; // 1 ETH = 1000 Token

    constructor(address initialOwner) Ownable(initialOwner) ERC20("Vending Token", "VTK") {}

    // 铸造代币给合约（供用户兑换）
    function mintToContract(uint256 amount) external onlyOwner {
        _mint(address(this), amount * 10 ** decimals());
    }

    // 用户存入 ETH，获得代币
    function depositETH() external payable {
        require(msg.value > 0, "Must send ETH");

        uint256 tokenAmount = msg.value * RATE;
        require(
            balanceOf(address(this)) >= tokenAmount,
            "Contract does not have enough tokens"
        );

        _transfer(address(this), msg.sender, tokenAmount);
    }

    // 用户销毁代币，换回 ETH
    function withdrawETH(uint256 tokenAmount) external {
        require(tokenAmount > 0, "Must withdraw positive amount");

        uint256 ethAmount = tokenAmount / RATE;
        require(ethAmount > 0, "Token amount too small");
        require(
            address(this).balance >= ethAmount,
            "Contract does not have enough ETH"
        );

        _burn(msg.sender, tokenAmount);

        (bool success, ) = msg.sender.call{value: ethAmount}("");
        require(success, "ETH transfer failed");
    }

    // owner: 提取合约中的 ETH
    function withdrawETHByOwner(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = owner().call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    // owner: 提取合约中的代币
    function withdrawTokensByOwner(uint256 amount) external onlyOwner {
        _transfer(address(this), owner(), amount);
    }
}
```

**关键设计解释：**

| 元素 | 说明 |
|---|---|
| `payable` 函数 | `depositETH()` 可以接收 ETH，msg.value 是收到的 ETH 数量 |
| `address(this).balance` | 合约当前持有的 ETH 余额 |
| `_transfer` | 从合约转代币给用户 |
| `_burn` | 销毁用户持有的代币 |
| `msg.sender.call{value: ethAmount}("")` | 转 ETH 给用户（推荐方式） |
| `Ownable` | 只有 owner 可以调用某些函数 |

### Step 4：编写测试

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {VendingMachineToken} from "../src/VendingMachineToken.sol";

contract VendingMachineTokenTest is Test {
    VendingMachineToken public vmToken;
    address public owner;
    address public user1;
    address public user2;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        vmToken = new VendingMachineToken(owner);

        // 给合约铸造一些代币用于兑换
        vmToken.mintToContract(1_000_000);
    }

    // ========== 铸造测试 ==========

    function test_mintToContract() public {
        uint256 amount = 1000;
        vmToken.mintToContract(amount);
        assertEq(vmToken.balanceOf(address(this)), amount * 10 ** 18);
    }

    // ========== 存款 ETH 获得代币 ==========

    function test_depositETH_getTokens() public {
        uint256 ethAmount = 1 ether;

        vm.deal(user1, 10 ether); // 给 user1 设置 ETH 余额
        vm.prank(user1);

        uint256 tokenBefore = vmToken.balanceOf(user1);
        vmToken.depositETH{value: ethAmount}();
        uint256 tokenAfter = vmToken.balanceOf(user1);

        uint256 expectedTokens = ethAmount * vmToken.RATE();
        assertEq(tokenAfter - tokenBefore, expectedTokens);
    }

    function test_depositETH_revertsIfZero() public {
        vm.prank(user1);
        vm.expectRevert("Must send ETH");
        vmToken.depositETH{value: 0}();
    }

    function test_depositETH_revertsIfNoTokens() public {
        // 创建一个没有代币的合约
        VendingMachineToken newVm = new VendingMachineToken(owner);
        vm.deal(user1, 10 ether);
        vm.prank(user1);
        vm.expectRevert("Contract does not have enough tokens");
        newVm.depositETH{value: 1 ether}();
    }

    // ========== 销毁代币换回 ETH ==========

    function test_withdrawETH_getETH() public {
        // 先存款
        vm.deal(user1, 10 ether);
        vm.prank(user1);
        vmToken.depositETH{value: 1 ether}();
        uint256 tokenBalance = vmToken.balanceOf(user1);

        // 准备提取
        uint256 ethBefore = user1.balance;
        vm.prank(user1);
        vmToken.withdrawETH(tokenBalance);
        uint256 ethAfter = user1.balance;

        assertEq(vmToken.balanceOf(user1), 0);
        // 注意：实际获得的 ETH 可能因为舍入而略少于预期
    }

    function test_withdrawETH_revertsIfZero() public {
        vm.prank(user1);
        vm.expectRevert("Must withdraw positive amount");
        vmToken.withdrawETH(0);
    }

    function test_withdrawETH_revertsIfInsufficientETH() public {
        // 存款但不mint足够ETH给合约
        VendingMachineToken newVm = new VendingMachineToken(owner);
        newVm.mintToContract(1000); // 只mint 1000 tokens

        // user1 买走所有代币
        vm.deal(user1, 100 ether);
        vm.prank(user1);
        vmToken.depositETH{value: 1 ether}(); // 消耗完合约的 ETH

        // 现在合约 ETH 不足
        vm.prank(user1);
        vm.expectRevert("Contract does not have enough ETH");
        vmToken.withdrawETH(1000 * 10 ** 18);
    }

    // ========== Owner 功能测试 ==========

    function test_ownerCanWithdrawETH() public {
        uint256 contractEthBefore = address(vmToken).balance;
        uint256 ownerEthBefore = owner.balance;

        vmToken.withdrawETHByOwner(1 ether);

        assertEq(address(vmToken).balance, contractEthBefore - 1 ether);
    }

    function test_nonOwnerCannotWithdrawETH() public {
        vm.prank(user1);
        vm.expectRevert();
        vmToken.withdrawETHByOwner(1 ether);
    }

    function test_ownerCanWithdrawTokens() public {
        vmToken.withdrawTokensByOwner(1000 * 10 ** 18);
        assertEq(vmToken.balanceOf(owner), 1000 * 10 ** 18);
    }

    // ========== 边界测试 ==========

    function test_multipleDeposits() public {
        vm.deal(user1, 10 ether);

        vm.prank(user1);
        vmToken.depositETH{value: 0.5 ether}();

        vm.prank(user1);
        vmToken.depositETH{value: 0.5 ether}();

        uint256 expected = 1000 * 10 ** 18; // 1 ETH * RATE
        assertEq(vmToken.balanceOf(user1), expected);
    }

    function test_receivingETHDirectly() public {
        // 直接转 ETH 给合约（不会获得代币）
        vm.deal(user1, 10 ether);
        vm.prank(user1);
        (bool success, ) = address(vmToken).call{value: 1 ether}("");
        require(success);

        // user1 没有获得代币
        assertEq(vmToken.balanceOf(user1), 0);
        // 合约余额增加了
        assertEq(address(vmToken).balance, 1 ether);
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

# 1. 先部署合约
forge create --rpc-url $SEPOLIA_RPC_URL \
             --private-key $PRIVATE_KEY \
             src/VendingMachineToken.sol:VendingMachineToken \
             --constructor-args $DEPLOYER_ADDRESS

# 2. 给合约铸造代币
cast send <CONTRACT_ADDRESS> "mintToContract(uint256)" 100000 \
    --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL
```

### Step 6：用 Cast 验证

```bash
# 查询合约 ETH 余额
cast balance <CONTRACT_ADDRESS> --rpc-url $SEPOLIA_RPC_URL

# 查询合约代币余额
cast call <CONTRACT_ADDRESS> "balanceOf(address)" <CONTRACT_ADDRESS> \
    --rpc-url $SEPOLIA_RPC_URL

# 用户存入 0.1 ETH，获得代币
cast send <CONTRACT_ADDRESS> "depositETH()" \
    --value 0.1ether \
    --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL

# 查询用户代币余额
cast call <CONTRACT_ADDRESS> "balanceOf(address)" $USER_ADDRESS \
    --rpc-url $SEPOLIA_RPC_URL

# 用户销毁代币换回 ETH
cast send <CONTRACT_ADDRESS> "withdrawETH(uint256)" <TOKEN_AMOUNT> \
    --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL
```

---

## 验收标准

```
✅ 存款 ETH 获得正确数量的代币（1 ETH = 1000 Token）
✅ 销毁代币换回正确数量的 ETH
✅ 存款 0 ETH 被拒绝
✅ 合约代币不足时被拒绝
✅ 合约 ETH 不足时被拒绝
✅ 非 owner 无法提取 ETH
✅ owner 可以正常提取
✅ 多次存款累计正确
✅ 直接转 ETH 给合约不会获得代币
✅ forge test 全部通过，覆盖率 100%
```

---

## 重入攻击初识

虽然本合约使用了 `msg.sender.call{value:}""` 转 ETH，但目前没有明显的重入风险（因为转账前已经扣除了代币）。

但需要了解：
- **为什么 Call 可以被回调**：如果接收方是合约，会触发 `receive()` 或 `fallback()` 函数
- **CEI 模式（Checks-Effects-Interactions）**：先检查条件，再更新状态，最后交互

```
本合约 withdrawETH 的 CEI：
1. Check: 检查 tokenAmount > 0
2. Check: 检查 ethAmount > 0
3. Check: 检查合约 ETH 充足
4. Effect: _burn(msg.sender, tokenAmount) ← 先扣代币
5. Interaction: call{value:} 转 ETH ← 最后交互
```

---

## 扩展挑战

| 挑战 | 提示 |
|---|---|
| 加动态汇率（owner 可调） | 添加 `setRate(uint256 newRate)` 函数 |
| 加存款事件 `Deposited(address user, uint256 eth, uint256 tokens)` | 触发事件供 Cast 监听 |
| 加取款事件 `Withdrawn(address user, uint256 eth, uint256 tokens)` | |
| 防止小数精度问题 | 目前 `1 ETH = 1000 Token`，如果汇率不是整数需要处理 |

---

## 目录结构

```
03-VendingMachine/
├── README.md                    ← 本文件
├── IMPLEMENTATION.md            ← 分步实现指南
└── KNOWLEDGE.md                 ← 相关知识补充
```
