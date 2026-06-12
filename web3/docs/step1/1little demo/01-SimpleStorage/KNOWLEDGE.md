# SimpleStorage - 相关知识补充

## 1. Solidity 基础概念

### 状态变量 vs 局部变量

```solidity
contract Example {
    uint256 public stateVar = 10;  // 状态变量，存储在合约存储区

    function example() public {
        uint256 localVar = 20;     // 局部变量，存储在内存（memory）
        // ...
    }
}
```

**关键区别：**

| 类型 | 存储位置 | 生命周期 | gas 消耗 |
|---|---|---|---|
| 状态变量 | Storage（链上持久存储） | 合约生命周期 | 高（写入） |
| 局部变量 | Memory（临时内存） | 函数执行期间 | 低 |
| Calldata | Calldata（函数参数专用） | 仅函数调用 | 最低 |

### 变量可见性

```solidity
uint256 public publicVar;      // 任何人都能读取，自动生成 getter 函数
uint256 private privateVar;    // 只有合约内部能访问
uint256 internal internalVar;  // 只有合约和子类能访问
```

`public` 状态变量会自动生成一个 getter 函数，等价于：

```solidity
uint256 public publicVar;

// 编译器自动生成：
function publicVar() public view returns (uint256) {
    return publicVar;
}
```

### 值类型 vs 引用类型



**值类型**（直接存储值）：
- `uint256`, `int256`, `address`, `bool`, `bytes32`
- 赋值时复制整个值

**引用类型**（存储引用）：
- `uint256[]`, `bytes`, `string`, `struct`
- 赋值时只传递引用，需要手动指定存储位置（`storage` / `memory` / `calldata`）

```solidity
// 值类型赋值
uint256 a = 10;
uint256 b = a;  // b 是 a 的副本，修改 b 不影响 a

// 引用类型赋值
uint256[] memory arr1 = new uint256[](3);
uint256[] memory arr2 = arr1;  // arr2 指向同一个数组
arr2[0] = 99;  // arr1[0] 也会变成 99
```

---

## 2. 函数基础

### 函数声明

```solidity
function functionName(paramType paramName) [visibility] [stateMutability] [returns(returnType)] {
    // function body
}
```

| 修饰符 | 选项 | 说明 |
|---|---|---|
| visibility | `public` / `external` / `internal` / `private` | 谁可以调用 |
| stateMutability | `pure` / `view` / `payable` / 无 | 是否修改状态 |

### view vs pure

```solidity
contract Example {
    uint256 public value = 10;

    // view：可以读取状态，但不能写入
    function readValue() public view returns (uint256) {
        return value;
    }

    // pure：既不读取也不写入状态
    function add(uint256 a, uint256 b) public pure returns (uint256) {
        return a + b;  // 不访问任何状态变量
    }

    // 无修饰符：可以读写状态
    function setValue(uint256 newValue) public {
        value = newValue;  // 修改状态
    }
}
```

**Gas 消耗对比：**

```
view / pure 函数（外部调用）：不消耗 gas（只读）
非 view/pure 函数（状态修改）：消耗 gas
```

注意：`view` / `pure` 在内部调用时仍然消耗 gas，只有外部调用/静态调用时不消耗。

### require 和错误处理

```solidity
function setValue(uint256 newValue) public {
    require(newValue > 0, "Value must be positive");
    // 或
    if (newValue == 0) {
        revert("Value must be positive");
    }
    value = newValue;
}
```

| 语句 | 适用场景 |
|---|---|
| `require(condition, "msg")` | 验证前置条件，失败时退还剩余 gas |
| `revert("msg")` | 无条件回滚 |
| `revert CustomError(args)` | 推荐方式，gas 效率更高 |

---

## 3. Forge 测试基础

### 基本结构

```solidity
import {Test, console} from "forge-std/Test.sol";

contract MyContractTest is Test {
    MyContract public myContract;

    // setUp 在每个测试函数前执行
    function setUp() public {
        myContract = new MyContract();
    }

    function test_something() public {
        // 测试逻辑
    }
}
```

### 常用断言

```solidity
assert(condition)                    // 断言为真
assertEq(actual, expected)           // 断言相等
assertEq(actual, expected, "message") // 带错误信息
assertTrue(condition)
assertFalse(condition)
assertGt(a, b)   // a > b
assertLt(a, b)   // a < b
```

### Forge 命令

```bash
forge test                    # 运行所有测试
forge test -vv                # 详细输出
forge test -vvvv              # 最详细（包含 console.log）
forge test --match-test testName  # 只运行指定测试
forge test --no-match-test testName  # 排除指定测试
forge coverage                # 覆盖率报告
```

### console.log 调试

```solidity
import {console} from "forge-std/Test.sol";

function test_example() public {
    console.log("Value is", 42);
    assertEq(someFunction(), 42);
}
```

---

## 4. EVM 存储基础

### Slot 布局

EVM 中，合约的持久数据存储在 `storage` 中，以 `slot` 为单位组织。

```solidity
contract StorageLayout {
    uint256 public slot0;      // slot 0
    bool public slot1;         // slot 1
    uint256 public slot2;      // slot 2
    // ...
}
```

### Forge 查看存储

```bash
# 查看合约 slot 0 的值
cast storage <CONTRACT_ADDRESS> 0 --rpc-url $SEPOLIA_RPC_URL

# 以太坊区块链浏览器也支持查看
# 在 Etherscan 上查看合约 "Read as Proxy" 或 "Read Contract"
```

### mapping 的存储

```solidity
contract MappingExample {
    mapping(address => uint256) public balances;

    function setBalance(address user, uint256 amount) public {
        balances[user] = amount;
    }
}
```

mapping 不按顺序存储，它的存储位置通过 `keccak256(key . slot)` 计算得到。

```bash
# 查询 address(0x123...) 的 balances
# slot = keccak256(abi.encode(address, 1))
cast keccak256 $(cast abi-encode "foo(address)" 0x123...)
```

---

## 5. 类型系统

### 整数类型

```solidity
uint8    to uint256    // 无符号整数
int8     to int256     // 有符号整数

// 常用简写
uint = uint256
int  = int256

// 类型边界
type(uint256).min  // 0
type(uint256).max  // 2^256 - 1
```

### 地址类型

```solidity
address public addr = 0x123...;

address public caller = msg.sender;  // 调用者地址

// 发送 ETH
payable(addr).transfer(1 ether);
payable(addr).send(1 ether);         // 需要检查返回值
(bool success, ) = addr.call{value: 1 ether}("");
```

### 合约类型

```solidity
contract MyContract { ... }

// 声明合约变量
MyContract public myContract;

// 从地址创建合约实例
MyContract myContract = MyContract(contractAddress);

// 或者使用接口
interface IMyContract {
    function getValue() external view returns (uint256);
}
IMyContract myContract = IMyContract(contractAddress);
```

---

## 6. 快速参考命令

```bash
# 初始化项目
forge init my-project
forge init my-project --force  # 强制覆盖

# 编译
forge build
forge build --force

# 测试
forge test
forge test -vv
forge coverage

# 格式化代码
forge fmt

# 生成 Gas 报告
forge snapshot
```

---

## 推荐阅读

- [Solidity by Example - Hello World](https://solidity-by-example.org/hello-world/)
- [Foundry Book - Testing](https://book.getfoundry.sh/forge/tests)
- [Cyfrin Foundry 课程](https://updraft.cyfrin.io/)
