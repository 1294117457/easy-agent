# Day 7：枚举与模式匹配（enum / match）

## 今日目标

今天你会接触 Rust 很有代表性的两个能力：`enum` 和 `match`。完成今天后，你应该能够：

- 理解 `enum` 不只是简单常量，而是状态建模工具
- 学会用 `match` 清晰地处理不同分支
- 用 Rust 的方式表达“一个值可能有多种状态”
- 为后面学习 `Option`、`Result` 打基础

建议学习时长：**2.5 ~ 3 小时**

建议时间分配：
- 45 分钟：理解概念
- 75 分钟：动手练习
- 30 分钟：复盘与整理

---

## 今天要学什么

### 1. 枚举（enum）是什么

#### 核心直觉
枚举表示：

> 一个值可能是多种情况中的一种。

#### 和你熟悉语言里的“枚举”有什么不同
在很多语言里，枚举更像：
- 一组命名常量
- 一组标签

而 Rust 的 `enum` 更强：
- 不仅能表示不同状态
- 每种状态还可以携带不同数据

这使它非常适合业务建模。

---

### 2. 最简单的枚举

#### 示例

```rust
enum Direction {
    Up,
    Down,
    Left,
    Right,
}

fn main() {
    let dir = Direction::Up;
}
```

#### 你要理解的重点
- `Direction` 是一个新类型
- 
- 这很适合表示有限状态集合

---

### 3. 带数据的枚举

#### 示例

```rust
enum Message {
    Text(String),
    Number(i32),
    Quit,
}

fn main() {
    let msg1 = Message::Text(String::from("hello"));
    let msg2 = Message::Number(100);
    let msg3 = Message::Quit;
}
```

#### 你要理解的重点
- `Text(String)` 表示这个分支带着一个字符串
- `Number(i32)` 表示这个分支带着一个整数
- Rust 的枚举不仅能区分类型，还能携带上下文数据

#### 为什么重要
你后面做项目时，会经常遇到：
- 成功 / 失败
- 已连接 / 未连接 / 连接中
- 文本消息 / 错误消息 / 事件消息

这些都很适合用 `enum` 表达。

---

### 4. `match` 是什么

#### 核心直觉
`match` 是 Rust 处理多分支情况的核心语法。它特别适合搭配 `enum` 使用。

#### 示例

```rust
enum Direction {
    Up,
    Down,
    Left,
    Right,
}

fn describe(dir: Direction) {
    match dir {
        Direction::Up => println!("向上"),
        Direction::Down => println!("向下"),
        Direction::Left => println!("向左"),
        Direction::Right => println!("向右"),
    }
}

fn main() {
    let dir = Direction::Left;
    describe(dir);
}
```

#### 你要理解的重点
- `match` 会根据不同模式走不同分支
- 它通常要求你把情况写全
- 这能减少遗漏分支的 bug

---

### 5. `match` 处理带数据的枚举

#### 示例

```rust
enum Message {
    Text(String),
    Number(i32),
    Quit,
}

fn handle_message(msg: Message) {
    match msg {
        Message::Text(text) => println!("文本消息: {}", text),
        Message::Number(n) => println!("数字消息: {}", n),
        Message::Quit => println!("退出"),
    }
}

fn main() {
    handle_message(Message::Text(String::from("hello")));
    handle_message(Message::Number(42));
    handle_message(Message::Quit);
}
```

#### 你要理解的重点
- `match` 不只是判断是哪一类
- 还可以把其中携带的数据取出来使用
- 这会让状态处理特别自然

---

## 今天建议你怎么练

### 练习 1：定义简单枚举
目标：理解“一个值只能是多种情况之一”

请自己定义一个 `Theme`：
- `Light`
- `Dark`
- `System`

参考结构：

```rust
enum Theme {
    Light,
    Dark,
    System,
}

fn main() {
    let current = Theme::Dark;
}
```

你要做的事：
- 自己改名字
- 再定义一个 `Role` 或 `Status` 枚举

---

### 练习 2：用 `match` 处理简单枚举
目标：熟悉枚举分支匹配

```rust
enum Theme {
    Light,
    Dark,
    System,
}

fn show_theme(theme: Theme) {
    match theme {
        Theme::Light => println!("浅色模式"),
        Theme::Dark => println!("深色模式"),
        Theme::System => println!("跟随系统"),
    }
}

fn main() {
    show_theme(Theme::System);
}
```

你要做的事：
- 改成处理语言模式、网络状态等
- 试着删掉一个分支，看编译器会怎样提醒你

---

### 练习 3：定义带数据的枚举
目标：理解 `enum` 可以携带数据

```rust
enum Event {
    Click(i32, i32),
    Input(String),
    Close,
}

fn main() {
    let e1 = Event::Click(100, 200);
    let e2 = Event::Input(String::from("hello"));
    let e3 = Event::Close;
}
```

你要做的事：
- 改成和你项目相关的事件，例如 `Connect(String)`、`Error(String)`、`Disconnect`

---

### 练习 4：用 `match` 处理带数据的枚举
目标：熟悉带数据分支的解构

```rust
enum ServerEvent {
    Connect(String),
    Error(String),
    Disconnect,
}

fn handle_event(event: ServerEvent) {
    match event {
        ServerEvent::Connect(name) => println!("连接成功: {}", name),
        ServerEvent::Error(msg) => println!("连接失败: {}", msg),
        ServerEvent::Disconnect => println!("已断开"),
    }
}

fn main() {
    handle_event(ServerEvent::Connect(String::from("mcp-local")));
    handle_event(ServerEvent::Error(String::from("timeout")));
    handle_event(ServerEvent::Disconnect);
}
```

---

### 练习 5：做一个“连接状态模型”
目标：把 enum 用到接近真实业务的场景中

要求：
定义一个 `ConnectionStatus`：
- `Disconnected`
- `Connecting`
- `Connected(String)`
- `Failed(String)`

再写一个函数，用 `match` 输出提示信息。

参考结构：

```rust
enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected(String),
    Failed(String),
}

fn show_status(status: ConnectionStatus) {
    match status {
        ConnectionStatus::Disconnected => println!("未连接"),
        ConnectionStatus::Connecting => println!("连接中"),
        ConnectionStatus::Connected(name) => println!("已连接: {}", name),
        ConnectionStatus::Failed(reason) => println!("连接失败: {}", reason),
    }
}

fn main() {
    show_status(ConnectionStatus::Connecting);
    show_status(ConnectionStatus::Connected(String::from("server-a")));
    show_status(ConnectionStatus::Failed(String::from("network error")));
}
```

---

## 今天要特别注意的概念

### 1. Rust 的 enum 非常适合状态建模
你以后做项目时，很多 TS 里的字符串状态，例如：
- `"idle"`
- `"loading"`
- `"success"`
- `"error"`

在 Rust 里通常更推荐写成 `enum`。

这样做的好处是：
- 状态集合更明确
- 不容易写错字符串
- 更适合配合 `match` 做完整处理

### 2. `match` 的完整性很重要
Rust 希望你把所有情况写清楚，这和它整体强调安全、显式、少遗漏是一致的。

### 3. 带数据的分支非常强大
你不仅知道“是什么状态”，还能同时拿到“状态里的附加数据”。

---

## 和 Java / TS 的对比理解

### 和 Java 比
- Java 传统 enum 更偏固定值集合
- Rust enum 更像“类型 + 状态 + 数据”结合体

### 和 TypeScript 比
- TS 常用联合类型表达多种状态
- Rust enum 在这方面有很类似但更底层、更严格的感觉
- `match` 很像对联合类型进行安全分支处理

---

## 今日小任务：做一个“任务执行状态机”

要求：
定义一个 `TaskState`：
- `Pending`
- `Running`
- `Success(String)`
- `Failed(String)`

然后写一个函数，根据状态打印不同结果。

目标：
你要开始体会 `enum + match` 在业务状态建模中的自然程度。

---

## 今天的最小复盘

请你自己回答：

1. Rust 的 enum 和普通“常量枚举”最大的不同是什么？
2. 为什么说 enum 很适合业务建模？
3. `match` 为什么比一长串 `if / else` 更适合处理状态？
4. 带数据的枚举分支有什么价值？
5. 如果你要为 MCP server 建模状态，会设计哪些分支？

---

## 今天和 Tauri 的联系

你以后做 Tauri + Rust 时，`enum + match` 会高频出现：

- 连接状态
- 命令结果
- 插件事件
- 流程执行状态
- 错误类型

这两个能力几乎是 Rust 项目中最有价值的建模工具之一。

特别是你未来做 Web3、本地客户端、工具平台时，状态复杂度往往会上升，`enum` 的价值会非常明显。

---

## 今日完成标准

如果你满足下面这些，就算今天学得合格：

- 你能定义简单枚举和带数据枚举
- 你能用 `match` 处理不同分支
- 你能解释为什么 `enum` 很适合状态建模
- 你至少手敲运行了 4 个例子
- 你能自己设计一个和项目相关的状态枚举

---

## 明天预告

明天你会学：
- `Option`
- `Result`
- `?` 操作符

这会让你开始真正接触 Rust 的“空值处理”和“错误处理”核心模式。