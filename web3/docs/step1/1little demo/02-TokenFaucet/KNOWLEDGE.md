# TokenFaucet - 相关知识补充

## 1. ERC20 标准详解

ERC20 是以太坊上代币的标准接口，定义了代币的基本操作。

### 核心函数

```solidity
interface IERC20 {
    // 查询
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);

    // 操作
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // 事件
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
```

### OpenZeppelin ERC20 实现

```solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    constructor() ERC20("My Token", "MTK") {
        // 铸造代币
        _mint(msg.sender, 1000 * 10 ** decimals());
    }
}
```

### decimals（精度）

`decimals()` 返回代币的精度位数，默认是 18。

```
1 Token = 10^18 单位（1 Ether = 10^18 Wei 的类比）

1000000000000000000 = 1 Token (10^18)
1000000000000000    = 0.001 Token (10^15)
```

### 为什么要用 decimals

EVM 不支持浮点数，用整数表示可以避免精度问题：
- 所有计算都是整数运算
- 精度统一用 10^18 做乘除

---

## 2. mapping（映射）

mapping 是 Solidity 中类似哈希表的数据结构。

### 基本语法

```solidity
mapping(KeyType => ValueType) public myMapping;
```

| KeyType 可选 | ValueType 可选 |
|---|---|
| `address` | 任意类型 |
| `uint256` | |
| `bytes32` | |
| `string`（不推荐作 key） | |

### 使用示例

```solidity
contract Mappings {
    // 地址 => 余额
    mapping(address => uint256) public balances;

    // 地址 => 是否已操作
    mapping(address => bool) public hasClaimed;

    // 嵌套 mapping：owner => spender => 授权额度
    mapping(address => mapping(address => uint256)) public allowance;

    function setBalance(address user, uint256 amount) external {
        balances[user] = amount;
    }

    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }

    // 如果 key 不存在，返回默认值（0 / false）
    function checkIfNew(address user) external view returns (bool) {
        return balances[user] == 0; // 未设置过返回 true
    }
}
```

### mapping 的特性

```
1. 所有 key 的默认值都是 0 / false / address(0)
2. mapping 不能遍历（没有 keys() 函数）
3. mapping 的存储位置一定是 storage
4. mapping 可以作为 struct 的成员
5. mapping 可以嵌套（mapping(address => mapping(uint => bool)))
```

### 遍历 mapping 的替代方案

如果需要遍历，可以用数组配合 mapping：

```solidity
contract WithIteration {
    address[] public users;  // 用于遍历
    mapping(address => bool) public isUser;

    function addUser(address user) external {
        require(!isUser[user], "Already a user");
        users.push(user);
        isUser[user] = true;
    }

    function getUserCount() external view returns (uint256) {
        return users.length;
    }
}
```

---

## 3. OpenZeppelin 安全库

### Ownable（所有权控制）

```solidity
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyContract is Ownable {
    function restrictedAction() external onlyOwner {
        // 只有合约 owner 能执行
    }
}

constructor() Ownable(msg.sender) {}
```

### ReentrancyGuard（重入保护）

```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract UnsafeContract is ReentrancyGuard {
    function withdraw() external nonReentrant {
        // 保护函数不被重入
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        require(success);
    }
}
```

> **注意**：本项目不涉及外部调用，暂不需要 ReentrancyGuard，后续 VendingMachine 项目会用到。

---

## 4. vm.prank 和测试技巧

### Foundry 测试中的地址模拟

```solidity
function test_example() public {
    address user = address(0x1);

    // 模拟 user 调用（下一个调用使用 user 作为 msg.sender）
    vm.prank(user);
    contract.someFunction();

    // 如果需要连续调用
    vm.startPrank(user);
    contract.function1();
    contract.function2();
    vm.stopPrank();

    // 默认测试账户（address(this) = 0xb4c79dB8)
}
```

### 常用 Test 工具函数

```solidity
import {Test, console} from "forge-std/Test.sol";

// 地址工具
address(0x1)           // 硬编码地址
makeAddr("alice")      // 生成确定性的测试地址
.addr                  // 获取对应私钥
vm.addr(1)             // 私钥 1 对应的地址

// 余额工具
deal(address, amount)  // 给地址设置 ETH 余额
deal(token, address, amount)  // 给地址设置 ERC20 余额

// 状态工具
vm.prank(addr)         // 模拟 addr 调用
vm.startPrank(addr)     // 开始连续模拟
vm.stopPrank()          // 停止模拟
vm.expectRevert()       // 期望 revert
vm.expectRevert(bytes4(keccak256("Error(string)")))
```

### deal 工具

```solidity
// 给地址设置 ETH 余额
deal(address(0x1), 100 ether);

// 给地址设置 ERC20 余额（需要 token 地址）
deal(address(token), user, 1000e18);
```

---

## 5. require vs revert

### require（推荐用于前置条件）

```solidity
require(condition, "错误信息");
```

```solidity
// 好
require(balance >= amount, "Insufficient balance");

// 好（自定义错误）
require(balance >= amount, Errors.INSUFFICIENT_BALANCE);
```

### revert（推荐用于复杂逻辑）

```solidity
if (condition) {
    revert("Error message");
}

// 或者 revert with custom error
if (condition) {
    revert CustomError(args);
}
```

### 自定义错误（推荐，gas 更省）

```solidity
error Unauthorized();
error InsufficientBalance(uint256 available, uint256 required);

function withdraw(uint256 amount) external {
    if (balance < amount) {
        revert InsufficientBalance(balance, amount);
    }
    // ...
}
```

---

## 6. 事件（Events）入门

事件是合约向区块链外传递信息的方式。

### 定义事件

```solidity
contract Events {
    event Claimed(address indexed user, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 amount);

    function claim() external {
        // ...
        emit Claimed(msg.sender, amount);  // 触发事件
    }
}
```

| 关键字 | 说明 |
|---|---|
| `event` | 声明事件 |
| `indexed` | 将参数标记为索引，可以按这个参数过滤（最多 3 个 indexed） |

### 用 Cast 查询事件

```bash
# 查询 Transfer 事件（需要知道合约地址和 block 范围）
cast logs --from-block 0 --to-block latest \
    "Transfer(address,address,uint256)" \
    <CONTRACT_ADDRESS> \
    --rpc-url $SEPOLIA_RPC_URL

# 查询特定地址的 Transfer 事件
cast logs --from-block 0 --to-block latest \
    --address <CONTRACT_ADDRESS> \
    "Transfer(address,address,uint256)" \
    <FROM_ADDRESS> <TO_ADDRESS> \
    --rpc-url $SEPOLIA_RPC_URL
```

---

## 推荐阅读

- [OpenZeppelin - ERC20 文档](https://docs.openzeppelin.com/contracts/5.x/erc20)
- [Solidity by Example - ERC20](https://solidity-by-example.org/token/)
- [ERC20 标准 (EIP-20)](https://eips.ethereum.org/EIPS/eip-20)
