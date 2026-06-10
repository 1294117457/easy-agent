# BulletinBoard - 相关知识补充

## 1. struct（结构体）

struct 允许将多个不同类型的数据组合成一个自定义类型。

### 定义和使用

```solidity
// 定义结构体
struct Message {
    address author;    // 字段 1
    string content;    // 字段 2
    uint256 timestamp; // 字段 3
}

// 作为状态变量
contract Example {
    Message[] public messages;

    function createMessage(string calldata content) external {
        // 方式 1: 按字段赋值
        Message memory msg;
        msg.author = msg.sender;
        msg.content = content;
        msg.timestamp = block.timestamp;
        messages.push(msg);

        // 方式 2: 一次性赋值（推荐）
        messages.push(Message({
            author: msg.sender,
            content: content,
            timestamp: block.timestamp
        }));

        // 方式 3: 按顺序赋值
        messages.push(Message(msg.sender, content, block.timestamp));
    }
}
```

### 字段排序与存储

struct 中的字段按声明顺序存储在 storage 中：

```solidity
struct Example {
    uint128 a;  // slot 0
    uint128 b;  // slot 1
    address c;  // slot 2
    uint256 d;  // slot 3 ← 不是紧挨着，因为类型大小
}
```

**存储优化**：将相同大小的类型放在一起可以节省 slot。

### struct 作为参数和返回值

```solidity
// 函数参数中使用 struct
function updateMessage(uint256 id, Message memory newMsg) external {
    messages[id] = newMsg;
}

// 返回 struct
function getMessage(uint256 id) external view returns (Message memory) {
    return messages[id];
}
```

---

## 2. 动态数组

### 基本操作

```solidity
contract Arrays {
    uint256[] public uintArray;

    function operations() external {
        // 添加元素（push）
        uintArray.push(1);
        uintArray.push(2);
        uintArray.push(3);

        // 获取长度
        uint256 len = uintArray.length;  // 3

        // 按索引访问
        uint256 first = uintArray[0];  // 1

        // 修改元素
        uintArray[1] = 99;

        // 删除元素（设置为默认值，不减少长度）
        delete uintArray[1];  // 变成 0

        // 删除整个数组
        delete uintArray;  // 长度变 0

        // 弹出最后一个元素（会减少长度）
        uint256 last = uintArray.pop();  // 返回 3，数组长度变成 2
    }
}
```

### memory 数组

```solidity
function createDynamicArray(uint256 size) external pure returns (uint256[] memory) {
    // 动态内存数组（必须在创建时指定大小）
    uint256[] memory arr = new uint256[](size);

    // 或者固定大小
    uint256[5] memory fixedArr;

    return arr;
}
```

---

## 3. 事件（Events）深入

### 声明事件

```solidity
contract Events {
    // 最多 3 个 indexed 参数
    event Transfer(
        address indexed from,    // 可按 from 过滤查询
        address indexed to,      // 可按 to 过滤查询
        uint256 amount           // 普通参数
    );

    // 匿名事件（不记录 event signature，gas 更省，但不能用 topic 过滤）
    event Deposit(address sender, uint256 amount) anonymous;
}
```

### 触发事件

```solidity
function transfer(address to, uint256 amount) external {
    // ...
    emit Transfer(msg.sender, to, amount);
}
```

### 事件的工作原理

```
合约代码        →      事件日志（RLP编码）     →      区块数据
emit Event(...)  →  event signature hash  →  topic[0]
                   →  indexed 参数        →  topic[1], [2], [3]
                   →  普通参数            →  data (非 index 字段)
```

### 用 Cast 查询事件

```bash
# 查询 Transfer 事件
cast logs --from-block 0 --to-block latest \
    "Transfer(address,address,uint256)" \
    <CONTRACT_ADDRESS> \
    --rpc-url $SEPOLIA_RPC_URL

# 按特定地址过滤（from 或 to）
cast logs --from-block 0 --to-block latest \
    --address <CONTRACT_ADDRESS> \
    "Transfer(address,address,uint256)" \
    <FROM_ADDRESS> <TO_ADDRESS> \
    --rpc-url $SEPOLIA_RPC_URL

# 获取事件详细信息（解析为可读格式）
cast receipt <TX_HASH> | grep -A 10 "logs"
```

### 事件的 gas 消耗

```
不 indexed 参数：参数编码后存入 data，gas 相对较低
indexed 参数：参数存为 topic，gas 较高（每个 topic 375 gas）
anonymous 事件：没有 topic[0]（事件签名），更省 gas
```

---

## 4. storage / memory / calldata 详解

### 三种数据位置

```solidity
contract DataLocations {
    // ========== storage ==========
    // 永久存储在链上，合约所有函数都可以访问
    uint256[] public storageArray;

    // ========== memory ==========
    // 临时存储，函数执行结束后销毁
    function f(string memory s) public pure returns (string memory) {
        string memory local = s;  // 拷贝到 memory
        return local;
    }

    // ========== calldata ==========
    // 函数参数的专用位置，只能读取，不能修改
    function g(string calldata s) external pure returns (uint256) {
        // s = "modified";  // 编译错误
        return bytes(s).length;
    }
}
```

### 存储位置规则

| 上下文 | 默认位置 | 强制指定 |
|---|---|---|
| 状态变量 | storage | - |
| 函数参数（复杂类型） | memory/calldata | 可指定 |
| 函数返回值 | memory | 可指定 |
| 局部变量（引用类型） | storage（如果引用状态变量） | 可指定 |

### gas 消耗对比

```
calldata（参数）   <  memory（局部）  <  storage（状态）
   最低              中等              最高
```

**最佳实践**：

```solidity
// 好：external 函数参数用 calldata
function processData(string calldata data) external pure {
    // ...
}

// 好：内部函数可以用 memory
function internalProcess(string memory data) internal pure {
    // ...
}

// 好：返回 memory 数组
function getData() external view returns (uint256[] memory) {
    uint256[] memory result = new uint256[](10);
    return result;
}
```

---

## 5. 字符串处理基础

### 字符串是特殊的字节数组

```solidity
contract StringUtils {
    function stringToBytes(string memory s) internal pure returns (bytes memory) {
        return bytes(s);
    }

    function getStringLength(string calldata s) external pure returns (uint256) {
        return bytes(s).length;
    }

    function isEmpty(string calldata s) external pure returns (bool) {
        return bytes(s).length == 0;
    }
}
```

### 字符串比较

```solidity
// 字符串相等检查（需要逐字节比较）
function stringsEqual(string calldata a, string calldata b) external pure returns (bool) {
    return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
}
```

### 字符串拼接

```solidity
// 方式 1: abi.encodePacked
function concatenate(string calldata a, string calldata b) external pure returns (string memory) {
    return string(abi.encodePacked(a, b));
}

// 方式 2: vm.toString (Foundry 测试中)
string memory combined = string.concat("Hello ", vm.toString(123));
```

---

## 6. 分页查询的设计考量

### 为什么需要分页

```
不推荐：返回所有数据
  - 数组很大时 gas 消耗爆炸
  - 可能超过区块 gas limit
  - 前端加载慢

推荐：分页查询
  - 每次只获取一页数据
  - gas 可控
  - 前端体验更好
```

### 分页实现模式

```solidity
// 模式 1: offset + limit（适合顺序遍历）
function getPage(uint256 offset, uint256 limit) external view returns (Item[] memory) {
    // offset: 起始位置
    // limit: 每页大小
}

// 模式 2: cursor-based（适合实时数据）
function getPage(uint256 cursor, uint256 limit) external view returns (Item[] memory, uint256 nextCursor) {
    // 返回下一页的 cursor
}

// 模式 3: 前端计算（适合小数据集）
function getMessages(uint256 page, uint256 pageSize) external view {
    // 前端：start = (page - 1) * pageSize
}
```

---

## 推荐阅读

- [Solidity by Example - Structs and Arrays](https://solidity-by-example.org/data-locations/)
- [Solidity Docs - Layout of State Variables in Storage](https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html)
- [Foundry Book - Events](https://book.getfoundry.sh/forge/casts/cast-events)
