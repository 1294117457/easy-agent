# SimpleStorage - 简单存储合约

## 项目概述

写一个合约，存储一个数字，可以修改，可以读取。

## 学习目标

- Solidity 基础语法（状态变量、函数、visibility）
- `public` 变量自动生成 getter
- Forge 写测试跑通第一个合约
- 用 Cast 和链上合约交互

---

## 一步步实现

### Step 1：初始化 Foundry 项目

```bash
forge init simple-storage
cd simple-storage
```

目录结构：

```
simple-storage/
├── src/
│   └── SimpleStorage.sol       ← 你的合约代码
├── test/
│   └── SimpleStorage.t.sol     ← 你的测试代码
├── script/
│   └── SimpleStorage.s.sol     ← 部署脚本
├── foundry.toml               ← Foundry 配置
└── .env                       ← 环境变量（私钥、RPC URL）
```

### Step 2：编写合约

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SimpleStorage {
    uint256 private storedData;

    // 存储一个值
    function set(uint256 x) public {
        storedData = x;
    }

    // 读取存储的值
    function get() public view returns (uint256) {
        return storedData;
    }
}
```

**关键概念解释：**

| 语法 | 说明 |
|---|---|
| `uint256 private storedData` | 私有状态变量，默认值是 0 |
| `function set(uint256 x) public` | public 函数，任何地址都能调用 |
| `function get() public view returns (uint256)` | view 函数只读，不消耗 gas（本地调用） |

### Step 3：写测试

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {SimpleStorage} from "../src/SimpleStorage.sol";

contract SimpleStorageTest is Test {
    SimpleStorage public simpleStorage;

    function setUp() public {
        simpleStorage = new SimpleStorage();
    }

    // 测试 1：初始值为 0
    function test_initialValueIsZero() public {
        uint256 expectedValue = 0;
        assertEq(simpleStorage.get(), expectedValue);
    }

    // 测试 2：存储正数
    function test_setPositiveNumber() public {
        simpleStorage.set(42);
        assertEq(simpleStorage.get(), 42);
    }

    // 测试 3：存储 0
    function test_setZero() public {
        simpleStorage.set(0);
        assertEq(simpleStorage.get(), 0);
    }

    // 测试 4：存储最大值
    function test_setMaxUint256() public {
        uint256 maxVal = type(uint256).max;
        simpleStorage.set(maxVal);
        assertEq(simpleStorage.get(), maxVal);
    }

    // 测试 5：覆盖已有值
    function test_overwriteValue() public {
        simpleStorage.set(10);
        simpleStorage.set(99);
        assertEq(simpleStorage.get(), 99);
    }
}
```

运行测试：

```bash
forge test
```

### Step 4：部署到 Sepolia 测试网

配置 `.env`：

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY=0x_your_private_key
```

部署：

```bash
source .env
forge create --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY \
    src/SimpleStorage.sol:SimpleStorage
```

部署成功后，你会得到合约地址，例如：

```
Deployer: 0x1234...
Deployed to: 0xabcd...
```

### Step 5：用 Cast 和链上合约交互

```bash
# 查询当前值（应该返回 0）
cast call <CONTRACT_ADDRESS> "get()" --rpc-url $SEPOLIA_RPC_URL

# 存储一个值 100
cast send <CONTRACT_ADDRESS> "set(uint256)" 100 \
    --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL

# 再次查询，验证值已更新
cast call <CONTRACT_ADDRESS> "get()" --rpc-url $SEPOLIA_RPC_URL

# 查看交易详情
cast receipt <TX_HASH>
```

---

## 验收标准

```
✅ 初始状态 get() 返回 0
✅ set(100) 后 get() 返回 100
✅ set(type(uint256).max) 后值正确
✅ 部署到 Sepolia 测试网
✅ 用 Cast 查询和修改链上值
✅ forge test 全部通过，覆盖率 100%
```

---

## 扩展挑战

| 挑战 | 提示 |
|---|---|
| 加一个 `owner` 地址变量，存储时检查是否是 owner | 使用 `require(msg.sender == owner)` |
| 加一个 `ValueChanged` 事件，set 时触发 | `event ValueChanged(uint256 oldValue, uint256 newValue)` |
| 用 Cast 监听事件 | `cast logs --from-block <BLOCK> "ValueChanged(address,uint256,uint256)"` |

---

## 目录结构

```
01-SimpleStorage/
├── README.md                    ← 本文件
├── IMPLEMENTATION.md            ← 分步实现指南
└── KNOWLEDGE.md                 ← 相关知识补充
```
