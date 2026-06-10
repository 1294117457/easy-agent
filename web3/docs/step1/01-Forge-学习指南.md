# 01 - Foundry Forge 学习指南

## 什么是 Forge

**Forge** 是 Foundry 工具链中最核心的组件，充当智能合约的：
- 编译器
- 测试运行器
- 部署脚本执行器
- 包管理器

相当于 Hardhat + Truffle + Mocha 的合体，但用 Rust 驱动，速度快一个数量级。

---

## 理念：为什么先学 Forge

```
传统方式（Hardhat）：
  写 Solidity → 写 JavaScript 测试 → 运行测试（慢）

Foundry 方式（Forge）：
  写 Solidity → 写 Solidity 测试 → 运行测试（极快）
```

Forge 的核心优势：
- **原生 Solidity 测试**：测试代码也是 Solidity，不需要切换上下文
- **极速反馈**：修改代码后 `forge test` 几秒内出结果
- **内置模糊测试**：不需要配置，自动生成边界测试用例
- **符号执行**：能自动探索合约的边界条件

---

## 安装与环境配置

### 安装 Foundry

```bash
# 通过官方安装脚本
curl -L https://foundry.paradigm.xyz | bash

# 或通过 cargo 安装
cargo install --git https://github.com/foundry-rs/foundry foundry-anvil foundry-cli cast --locked

# 更新
foundryup
```

### 验证安装

```bash
forge --version
anvil --version
cast --version
```

### 初始化项目

```bash
forge init my-first-project
cd my-first-project

# 目录结构
my-first-project/
├── src/               # 合约源码
├── test/              # 测试文件
├── script/            # 部署脚本
├── lib/               # 依赖库（类似 node_modules）
├── foundry.toml       # Foundry 配置
└── cache/            # 缓存
```

---

## 核心命令

### forge build — 编译合约

```bash
forge build
forge build --optimizer              # 开启优化
forge build --contracts src/         # 指定源码目录
forge build --force                 # 强制重新编译
```

### forge test — 运行测试

```bash
forge test                           # 运行全部测试
forge test -vv                      # 显示详细日志（-vvv 更详细）
forge test --match-test testTransfer # 只跑指定测试
forge test --no-match-test testFail # 排除某个测试
forge test -f http://localhost:8545  # 指定 RPC 节点
```

### forge script — 部署脚本

```bash
forge script scripts/Deploy.s.sol    # 本地部署
forge script scripts/Deploy.s.sol --rpc-url $SEPOLIA_RPC --broadcast --private-key $PK  # 部署到 Sepolia
```

### forge install — 安装依赖

```bash
forge install openzeppelin/openzeppelin-contracts@v5.0.0
forge install foundry-rs/forge-std
```

### 其他常用命令

```bash
forge tree               # 查看依赖树
forge snapshot          # 生成 Gas 快照
forge coverage          # 生成测试覆盖率报告
forge clean             # 清理缓存
```

---

## Forge 测试入门

### 第一个测试

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {MyToken} from "../src/MyToken.sol";

contract MyTokenTest is Test {
    MyToken public token;

    function setUp() public {
        token = new MyToken();
    }

    function testTokenName() public view {
        assertEq(token.name(), "MyToken");
    }

    function testTransfer() public {
        token.transfer(address(1), 100);
        assertEq(token.balanceOf(address(1)), 100);
    }
}
```

### 关键概念

#### 1. setUp 函数

每个测试合约在运行测试前都会先调用 `setUp()`。适合在这里初始化合约状态。

```solidity
function setUp() public {
    token = new MyToken();
    // 也可以部署一套完整的协议栈
}
```

#### 2. assert 系列

| 方法 | 作用 |
|---|---|
| `assertTrue(bool)` | 断言为 true |
| `assertEq(a, b)` | 断言相等（支持 uint, address, bytes...） |
| `assertEq(a, b, "custom message")` | 带自定义消息的断言 |
| `assertGt / assertLt` | 大于 / 小于断言 |
| `assertEqDecimal` | 带小数的相等断言 |

#### 3. vm.prank — 模拟调用者

```solidity
function testTransferAsUser() public {
    // 模拟 address(1) 发起的调用
    vm.prank(address(1));
    token.transfer(address(2), 100);

    assertEq(token.balanceOf(address(2)), 100);
}
```

#### 4. vm.expectRevert — 断言 revert

```solidity
function testTransferFailsWithoutBalance() public {
    vm.expectRevert();
    token.transfer(address(2), 1000); // 地址 0 没有代币，应该 revert
}
```

```solidity
// 也可以精确匹配 revert 原因
function testInsufficientBalance() public {
    vm.expectRevert("Insufficient balance");
    token.transfer(address(2), 1000);
}
```

#### 5. vm.deal — 给地址充 ETH

```solidity
function testReceiveEther() public {
    vm.deal(address(1), 10 ether);  // 给 address(1) 10 ETH
    assertEq(address(1).balance, 10 ether);
}
```

#### 6. vm.startPrank / vm.stopPrank — 持续扮演

```solidity
function testMultipleCalls() public {
    vm.startPrank(address(1));
    token.transfer(address(2), 50);
    token.transfer(address(3), 30);
    vm.stopPrank();  // 停止扮演

    // 之后 address(1) 的调用不受影响
}
```

---

## 模糊测试（Fuzz Testing）

这是 Foundry 最强大的功能之一。普通测试是你指定输入，模糊测试是自动生成大量随机输入。

```solidity
function testTransfer(uint256 amount, address to) public {
    // 限定范围，避免边界问题
    amount = bound(amount, 0, token.balanceOf(address(this)));
    vm.assume(to != address(0));

    token.transfer(to, amount);
    assertEq(token.balanceOf(to), amount);
}
```

### bound 函数

```solidity
amount = bound(amount, min, max)
```
将 `amount` 限制在 `[min, max]` 范围内，避免 overflow / underflow。

### vm.assume

```solidity
vm.assume(condition)
```
如果条件不满足，直接跳过这个测试用例，不算失败。

**模糊测试的价值**：能发现人工测试想不到的边界 case，比如超大的 uint256、零地址等。

---

## 部署脚本

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MyToken} from "../src/MyToken.sol";

contract DeployMyToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        MyToken token = new MyToken();

        vm.stopBroadcast();

        console.log("Token deployed at:", address(token));
    }
}
```

```bash
# 运行脚本
forge script script/DeployMyToken.s.sol:DeployMyToken

# 部署到 Sepolia 测试网
forge script script/DeployMyToken.s.sol:DeployMyToken \
    --rpc-url $SEPOLIA_RPC \
    --private-key $PRIVATE_KEY \
    --broadcast
```

---

## foundry.toml 配置

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
optimizer = true
optimizer_runs = 200

[profile.ci]
fuzz_runs = 10000
verbosity = 4
```

---

## 学到什么程度算过关

完成以下任务即为过关：

| 任务 | 说明 |
|---|---|
| 跑通官方 Foundry Book 的所有示例 | 确保工具链熟练 |
| 写一个 ERC20 代币，并写 5 个以上测试 | 覆盖正常 case 和 revert case |
| 实现一个众筹合约（带退款逻辑），写完整测试 | 包含模糊测试 |
| 用 Foundry 部署到 Sepolia 测试网 | 跑通完整流程 |
| 用 `forge coverage` 查看测试覆盖率 > 90% | 确保测试质量 |

---

## 常见坑与解决

| 问题 | 原因 | 解决 |
|---|---|---|
| `vm.prank` 不生效 | 交易不通过 | 检查是否在 `broadcast` 内 |
| 测试通过但部署失败 | 构造函数参数不对 | 检查 ABI 编码 |
| Gas 估算失败 | 合约有 `view` 函数调用了非 view | 检查函数修饰符 |
| 模糊测试跑很久 | 无限循环 | 用 `bound` 限制输入范围 |
