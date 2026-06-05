# Day 8：Option、Result 与 `?` 操作符

## 今日目标

今天你会进入 Rust 项目开发中最常见的一组核心概念：`Option`、`Result` 和 `?`。完成今天后，你应该能够：

- 理解 `Option` ��如何替代空值的
- 理解 `Result` 是如何表达成功与失败的
- 学会用 `match` 处理这两种类型
- 初步掌握 `?` 在错误传播中的作用

建议学习时长：**3 小时左右**

建议时间分配：
- 50 分钟：概念理解
- 80 分钟：代码练习
- 30 分钟：复盘整理

---

## 今天要学什么

### 1. `Option<T>` 是什么

#### 核心直觉
有些值可能存在，也可能不存在。Rust 不鼓励你用 `null` 这类隐式空值，而是用 `Option<T>` 显式表达这种情况。

#### 两种状态
- `Some(T)`：有值
- `None`：没有值

#### 示例

```rust
fn find_user(id: i32) -> Option<String> {
    if id == 1 {
        Some(String::from("Alice"))
    } else {
        None
    }
}

fn main() {
    let user = find_user(1);
    println!("{:?}", user);
}
```

#### 你要理解的重点
- `Option` 表示“可能有，也可能没有”
- 它让“空值”这件事变成类型层面的显式信息
- 编译器会逼你认真处理它

---

### 2. 用 `match` 处理 `Option`

#### 示例

```rust
fn find_user(id: i32) -> Option<String> {
    if id == 1 {
        Some(String::from("Alice"))
    } else {
        None
    }
}

fn main() {
    let result = find_user(2);

    match result {
        Some(name) => println!("找到用户: {}", name),
        None => println!("没有找到用户"),
    }
}
```

#### 你要理解的重点
- 你不能假设一定有值
- 你必须处理 `None`
- 这比很多语言里的空指针行为更安全

---

### 3. `Result<T, E>` 是什么

#### 核心直觉
有些操作不仅可能有值，也可能失败。Rust 用 `Result<T, E>` 来表示这种“成功 / 失败”结果。

#### 两种状态
- `Ok(T)`：成功，拿到结果
- `Err(E)`：失败，拿到错误

#### 示例

```rust
fn parse_age(text: &str) -> Result<i32, String> {
    match text.parse::<i32>() {
        Ok(age) => Ok(age),
        Err(_) => Err(String::from("输入的不是合法整数")),
    }
}

fn main() {
    let result = parse_age("20");
    println!("{:?}", result);
}
```

#### 你要理解的重点
- `Result` 是 Rust 错误处理的核心方式
- 它不是“抛异常”，而是把成功和失败都作为值返回
- 这样调用方必须显式决定怎么处理错误

---

### 4. 用 `match` 处理 `Result`

#### 示例

```rust
fn parse_age(text: &str) -> Result<i32, String> {
    match text.parse::<i32>() {
        Ok(age) => Ok(age),
        Err(_) => Err(String::from("输入错误")),
    }
}

fn main() {
    match parse_age("abc") {
        Ok(age) => println!("年龄是 {}", age),
        Err(msg) => println!("失败原因: {}", msg),
    }
}
```

#### 你要理解的重点
- 成功和失败都是正常路径的一部分
- Rust 鼓励你明确处理失败，而不是忽略它

---

### 5. `?` 操作符是什么

#### 核心直觉
如果函数本身返回 `Result` 或 `Option`，你可以用 `?` 快速把错误或空值往外传，而不用手写一大段 `match`。

#### 示例

```rust
fn parse_number(text: &str) -> Result<i32, String> {
    match text.parse::<i32>() {
        Ok(num) => Ok(num),
        Err(_) => Err(String::from("解析失败")),
    }
}

fn double_number(text: &str) -> Result<i32, String> {
    let num = parse_number(text)?;
    Ok(num * 2)
}

fn main() {
    println!("{:?}", double_number("21"));
}
```

#### 你要理解的重点
- `?` 会在出错时提前返回
- 如果成功，就取出内部值继续往下执行
- 它能让错误处理代码简洁很多

---

## 今天建议你怎么练

### 练习 1：写一个返回 `Option` 的查找函数
目标：熟悉“值可能不存在”

要求：
- 写一个函数，根据 id 查用户名
- 如果 id 为 1，返回 `Some("Alice")`
- 否则返回 `None`

参考结构：

```rust
fn find_name(id: i32) -> Option<String> {
    if id == 1 {
        Some(String::from("Alice"))
    } else {
        None
    }
}

fn main() {
    match find_name(2) {
        Some(name) => println!("{}", name),
        None => println!("未找到"),
    }
}
```

---

### 练习 2：写一个返回 `Result` 的解析函数
目标：熟悉“操作可能失败”

要求：
- 写一个函数把字符串转整数
- 成功返回 `Ok(i32)`
- 失败返回 `Err(String)`

参考结构：

```rust
fn parse_port(text: &str) -> Result<i32, String> {
    match text.parse::<i32>() {
        Ok(port) => Ok(port),
        Err(_) => Err(String::from("端口号必须是整数")),
    }
}
```

你要做的事：
- 测试合法输入和非法输入
- 改错误消息内容

---

### 练习 3：用 `?` 串联两个步骤
目标：感受错误传播

要求：
- 先解析字符串成整数
- 再判断端口是否大于 0
- 如果有一步失败，直接返回错误

参考结构：

```rust
fn parse_port(text: &str) -> Result<i32, String> {
    match text.parse::<i32>() {
        Ok(port) => Ok(port),
        Err(_) => Err(String::from("端口格式错误")),
    }
}

fn validate_port(text: &str) -> Result<i32, String> {
    let port = parse_port(text)?;

    if port > 0 {
        Ok(port)
    } else {
        Err(String::from("端口必须大于 0"))
    }
}
```

---

### 练习 4：模拟读取配置项
目标：把 `Option` 和 `Result` 代入接近项目的场景

要求：
- 某个函数返回是否找到配置名，用 `Option`
- 某个函数返回配置是否解析成功，用 `Result`

思考：
- “没有找到配置” 和 “找到配置但格式错误” 是不是同一种问题？
- 为什么前者更适合 `Option`，后者更适合 `Result`？

---

### 练习 5：做一个“用户输入校验器”
目标：综合使用今天内容

要求：
- 输入一个字符串
- 尝试解析年龄
- 如果为空或非法，返回错误
- 如果成功，输出年龄翻倍值

---

## 今天要特别注意的概念

### 1. `Option` 和 `Result` 不一样
- `Option`：表示“有没有值”
- `Result`：表示“操作成功还是失败”

### 2. Rust 不鼓励“假装不会失败”
如果一个操作可能出错，最好在类型层面明确告诉调用方。

### 3. `?` 只是帮你简化写法，不是魔法
它背后仍然是：
- 如果成功，拿到值继续执行
- 如果失败，提前把错误返回出去

---

## 和 Java / TS 的对比理解

### 和 Java 比
- Java 常用 `null` + exception 处理很多问题
- Rust 更倾向把“空值”和“失败”显式放进类型里

### 和 TypeScript 比
- TS 常用 `undefined | null` 和 `throw`
- Rust 更强制你在编译阶段就把这些情况处理清楚

---

## 今日小任务：做一个“服务端口校验器”

要求：
- 写一个函数解析端口字符串
- 写一个函数校验端口范围
- 最终写一个总函数，返回 `Result<i32, String>`
- 尝试使用 `?` 简化中间流程

目标：
感受 `Result + ?` 是如何让业务逻辑更清晰的。

---

## 今天的最小复盘

请你自己回答：

1. `Option` 和 `Result` 分别适合什么场景？
2. 为什么 Rust 不推荐直接依赖空值？
3. `?` 的作用是什么？
4. “没找到用户”和“解析失败”有什么本质区别？
5. 你今天最容易混淆的点是什么？

---

## 今天和 Tauri 的联系

你以后做 Tauri + Rust 时，这些会高频出现：
- 读取配置文件可能失败
- 查找某个 server 可能不存在
- 解析 JSON 可能出错
- 命令执行结果需要返回给前端

所以 `Option`、`Result`、`?` 基本可以说是你以后写 Rust 后端逻辑的日常工具。

---

## 今日完成标准

如果你满足下面这些，就算今天学得合格：

- 你能区分 `Option` 和 `Result`
- 你能用 `match` 处理两者
- 你能写出一个使用 `?` 的函数
- 你至少手敲运行了 4 个例子
- 你能把今天的概念代入一个项目场景

---

## 明天预告

明天你会学：
- 生命周期（Lifetime）初识

这部分先建立理解，不追求一步到位掌握。