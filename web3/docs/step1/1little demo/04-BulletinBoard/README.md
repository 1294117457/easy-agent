# BulletinBoard - 链上留言板

## 项目概述

一个链上留言板合约，任何人可以留言，可以按页查询历史留言。学会使用 struct、event、动态数组和分页查询。

## 学习目标

- `struct` 和 `event` 的使用
- 动态数组 + 分页查询
- 理解链上存储的成本（`memory` vs `storage`）
- 用 Cast 查询历史事件（留言记录）
- gas 优化：循环中的 memory vs storage

---

## 一步步实现

### Step 1：初始化项目

```bash
forge init bulletin-board
cd bulletin-board
```

### Step 2：设计合约

**数据模型：**

```solidity
struct Message {
    address author;    // 留言者地址
    string content;    // 留言内容
    uint256 timestamp; // 留言时间
}
```

**核心功能：**

```
┌─────────────────────────────────────────┐
│           BulletinBoard 合约              │
├─────────────────────────────────────────┤
│                                         │
│  状态变量：                              │
│    messages: Message[]                  │
│                                         │
│  功能：                                 │
│    post(string content)                 │
│      - 添加新留言                        │
│      - 触发 Posted 事件                  │
│                                         │
│    getMessages(uint256 page, uint256 pageSize)  │
│      - 分页获取留言                      │
│      - 返回指定范围的留言                │
│                                         │
│    getMessageCount()                    │
│      - 获取总留言数                      │
│                                         │
└─────────────────────────────────────────┘
```

### Step 3：编写合约

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BulletinBoard {
    struct Message {
        address author;
        string content;
        uint256 timestamp;
    }

    Message[] public messages;

    // 事件：方便链外监听
    event Posted(uint256 indexed messageId, address indexed author, string content);

    // 发留言
    function post(string calldata content) external {
        require(bytes(content).length > 0, "Content cannot be empty");
        require(bytes(content).length <= 1000, "Content too long");

        messages.push(Message({
            author: msg.sender,
            content: content,
            timestamp: block.timestamp
        }));

        emit Posted(messages.length - 1, msg.sender, content);
    }

    // 分页获取留言（返回 memory 数组避免修改存储）
    function getMessages(uint256 page, uint256 pageSize) external view returns (Message[] memory) {
        require(page > 0, "Page must be greater than 0");
        require(pageSize > 0 && pageSize <= 100, "Invalid page size");

        uint256 totalMessages = messages.length;
        uint256 startIndex = (page - 1) * pageSize;

        // 边界检查
        if (startIndex >= totalMessages) {
            return new Message[](0);
        }

        // 计算实际返回数量
        uint256 endIndex = startIndex + pageSize;
        if (endIndex > totalMessages) {
            endIndex = totalMessages;
        }

        // 分配 memory 数组（只在内存中，不写入存储）
        uint256 returnSize = endIndex - startIndex;
        Message[] memory result = new Message[](returnSize);

        // 从 storage 复制到 memory（循环读取）
        for (uint256 i = 0; i < returnSize; i++) {
            result[i] = messages[startIndex + i];
        }

        return result;
    }

    // 获取总留言数
    function getMessageCount() external view returns (uint256) {
        return messages.length;
    }

    // 获取单条留言
    function getMessage(uint256 messageId) external view returns (address, string memory, uint256) {
        require(messageId < messages.length, "Message not found");
        Message memory msg = messages[messageId];
        return (msg.author, msg.content, msg.timestamp);
    }
}
```

**关键设计解释：**

| 元素 | 说明 |
|---|---|
| `struct Message` | 定义留言结构体 |
| `Message[] public messages` | 动态数组，存储所有留言 |
| `string calldata content` | 参数用 calldata，节省 gas（不需要拷贝） |
| `Message[] memory result` | memory 数组，只在函数内使用 |
| `require(bytes(content).length > 0)` | 检查空字符串 |

### Step 4：编写测试

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {BulletinBoard} from "../src/BulletinBoard.sol";

contract BulletinBoardTest is Test {
    BulletinBoard public board;

    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");

    function setUp() public {
        board = new BulletinBoard();
    }

    // ========== 发留言测试 ==========

    function test_postMessage() public {
        vm.prank(user1);
        board.post("Hello, Blockchain!");

        uint256 count = board.getMessageCount();
        assertEq(count, 1);

        (address author, string memory content, uint256 timestamp) = board.getMessage(0);
        assertEq(author, user1);
        assertEq(content, "Hello, Blockchain!");
        assertGt(timestamp, 0);
    }

    function test_postEmpty_reverts() public {
        vm.prank(user1);
        vm.expectRevert("Content cannot be empty");
        board.post("");
    }

    function test_postTooLong_reverts() public {
        vm.prank(user1);
        string memory longContent = new string(1001);
        vm.expectRevert("Content too long");
        board.post(longContent);
    }

    function test_multipleUsersPost() public {
        vm.prank(user1);
        board.post("Message from user1");

        vm.prank(user2);
        board.post("Message from user2");

        vm.prank(user3);
        board.post("Message from user3");

        assertEq(board.getMessageCount(), 3);

        (address author1, , ) = board.getMessage(0);
        (address author2, , ) = board.getMessage(1);
        (address author3, , ) = board.getMessage(2);

        assertEq(author1, user1);
        assertEq(author2, user2);
        assertEq(author3, user3);
    }

    // ========== 分页测试 ==========

    function test_getMessages_page1() public {
        // 发 15 条留言
        for (uint256 i = 0; i < 15; i++) {
            vm.prank(user1);
            board.post(string.concat("Message ", vm.toString(i)));
        }

        // 获取第 1 页，每页 10 条
        BulletinBoard.Message[] memory page1 = board.getMessages(1, 10);
        assertEq(page1.length, 10);

        assertEq(page1[0].author, user1);
        assertEq(page1[0].content, "Message 0");
    }

    function test_getMessages_page2() public {
        // 发 15 条留言
        for (uint256 i = 0; i < 15; i++) {
            vm.prank(user1);
            board.post(string.concat("Message ", vm.toString(i)));
        }

        // 获取第 2 页
        BulletinBoard.Message[] memory page2 = board.getMessages(2, 10);
        assertEq(page2.length, 5);  // 只有 5 条

        assertEq(page2[0].author, user1);
        assertEq(page2[0].content, "Message 10");
        assertEq(page2[4].content, "Message 14");
    }

    function test_getMessages_emptyPage() public {
        // 发 5 条留言
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(user1);
            board.post(string.concat("Message ", vm.toString(i)));
        }

        // 请求第 3 页（超出范围）
        BulletinBoard.Message[] memory page3 = board.getMessages(3, 10);
        assertEq(page3.length, 0);
    }

    function test_getMessages_invalidPageSize() public {
        vm.prank(user1);
        board.post("Test");

        vm.expectRevert("Invalid page size");
        board.getMessages(1, 0);

        vm.expectRevert("Invalid page size");
        board.getMessages(1, 101);
    }

    function test_getMessages_invalidPage() public {
        vm.prank(user1);
        board.post("Test");

        vm.expectRevert("Page must be greater than 0");
        board.getMessages(0, 10);
    }

    // ========== 边界测试 ==========

    function test_getMessage_notFound() public {
        vm.expectRevert("Message not found");
        board.getMessage(0);
    }

    function test_largePageSize() public {
        // 发 50 条
        for (uint256 i = 0; i < 50; i++) {
            vm.prank(user1);
            board.post(string.concat("Msg ", vm.toString(i)));
        }

        // 一次获取所有
        BulletinBoard.Message[] memory all = board.getMessages(1, 50);
        assertEq(all.length, 50);
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

forge create --rpc-url $SEPOLIA_RPC_URL \
             --private-key $PRIVATE_KEY \
             src/BulletinBoard.sol:BulletinBoard
```

### Step 6：用 Cast 验证

```bash
# 发一条留言
cast send <CONTRACT_ADDRESS> "post(string)" "Hello from Cast!" \
    --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL

# 查询总留言数
cast call <CONTRACT_ADDRESS> "getMessageCount()" \
    --rpc-url $SEPOLIA_RPC_URL

# 查询第 1 条留言
cast call <CONTRACT_ADDRESS> "getMessage(uint256)" 0 \
    --rpc-url $SEPOLIA_RPC_URL

# 查询第 1 页（每页 10 条）
cast call <CONTRACT_ADDRESS> "getMessages(uint256,uint256)" 1 10 \
    --rpc-url $SEPOLIA_RPC_URL

# 监听 Posted 事件
cast logs --from-block <START_BLOCK> --to-block latest \
    "Posted(uint256,address,string)" \
    <CONTRACT_ADDRESS> \
    --rpc-url $SEPOLIA_RPC_URL
```

---

## 验收标准

```
✅ 发空留言被拒绝
✅ 发超过 1000 字符被拒绝
✅ 发留言后总计数 +1
✅ 多用户留言互不影响
✅ 第 1 页返回前 10 条
✅ 第 2 页返回后续内容
✅ 请求超出范围的页返回空数组
✅ 部署到 Sepolia 测试网
✅ 用 Cast 发留言和查询
✅ 用 Cast 监听 Posted 事件
✅ forge test 全部通过，覆盖率 100%
```

---

## 扩展挑战

| 挑战 | 提示 |
|---|---|
| 加评论功能（回复某条留言） | 添加 `replyTo` 字段指向父留言 ID |
| 加点赞功能 | 添加 `likes: mapping(uint256 => address[])` |
| 加字数限制（链上检查 vs 链下检查） | 链下检查 gas 更省 |
| 加"编辑"功能 | 不推荐（违反链上不可篡改性）|

---

## 目录结构

```
04-BulletinBoard/
├── README.md                    ← 本文件
├── IMPLEMENTATION.md            ← 分步实现指南
└── KNOWLEDGE.md                 ← 相关知识补充
```
