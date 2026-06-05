# Day 1：变量、可变性、基本类型、函数、注释

## 今日目标

今天的目标不是记住所有 Rust 细节，而是建立最基础的阅读和书写能力。完成今天后，你应该能够：

- 看懂最简单的 Rust 程序结构
- 理解 `let`、`mut`、基础类型、函数定义的基本用法
- 写出几个可以编译运行的小例子
- 对 Rust 和 Java / TypeScript 的语法差异有初步感觉

建议学习时长：**2 小时左右**

建议时间分配：
- 40 分钟：看概念
- 50 分钟：敲代码
- 30 分钟：整理笔记和复盘

---

## 今天要学什么

### 1. 变量（variable）

#### 是什么
变量是用来保存数据的名字。Rust 使用 `let` 定义变量。

#### 你要理解的重点
- Rust 变量默认是**不可变**的
- 如果想修改变量，必须显式写 `mut`
- 这种设计是 Rust 安全性的重要体现之一

#### 示例

```rust
fn main() {
    let name = "easy-agent";
    let mut count = 1;

    count = count + 1;

    println!("name = {}, count = {}", name, count);
}
```

#### 你现在只要记住
- `let`：定义变量
- `mut`：允许修改
- 不可变默认值是 Rust 的一种“先保护你”的风格

---

### 2. 基本数据类型

#### 是什么
Rust 中最常见的基础类型包括：
- 整数：`i32`、`i64`、`u32`
- 浮点数：`f32`、`f64`
- 布尔：`bool`
- 字符：`char`
- 字符串：`String`、`&str`

#### 你要理解的重点
- Rust 类型比较明确，编译器很重视类型安全
- 前期最常见的是：整数、布尔、字符串
- `String` 和 `&str` 先不要死磕，只先知道它们都和字符串有关

#### 示例

```rust
fn main() {
    let age: i32 = 20;
    let price: f64 = 19.99;
    let is_online: bool = true;
    let grade: char = 'A';
    let title: &str = "Rust 入门";

    println!("{} {} {} {} {}", age, price, is_online, grade, title);
}
```

#### 你现在只要记住
- Rust 可以自动推断类型
- 也可以手动标注类型
- 类型越明确，编译器越能帮你提前发现错误

---

### 3. 函数（function）

#### 是什么
函数是组织逻辑的基本方式，Rust 使用 `fn` 定义函数。

#### 你要理解的重点
- 函数名后面写参数
- 参数要写类型
- 返回值也要写类型
- `main` 是程序入口函数

#### 示例

```rust
fn add(a: i32, b: i32) -> i32 {
    a + b
}

fn is_even(num: i32) -> bool {
    num % 2 == 0
}

fn welcome(name: &str) -> String {
    format!("Hello, {}", name)
}

fn main() {
    println!("{}", add(2, 3));
    println!("{}", is_even(8));
    println!("{}", welcome("Tom"));
}
```

#### 你现在只要记住
- `fn` 用来定义函数
- `->` 后面是返回值类型
- Rust 函数的输入输出都很明确

---

### 4. 注释（comment）

#### 是什么
注释是写给人看的说明，不会被程序执行。

#### 你要理解的重点
Rust 常见注释有：
- 单行注释：`//`
- 多行注释：`/* ... */`
- 文档注释：`///`

#### 示例

```rust
/// 计算两个整数之和
fn add(a: i32, b: i32) -> i32 {
    // 返回计算结果
    a + b
}

fn main() {
    /* 这里调用 add 函数 */
    let result = add(1, 2);
    println!("{}", result);
}
```

#### 你现在只要记住
- 注释不是越多越好
- 注释要说明“意图”或“原因”
- 文档注释后面你做模块时会很有用

---

## 今天建议你怎么练

请按顺序自己动手写，不要只看。

### 练习 1：定义并打印变量
目标：熟悉 `let`、`mut`、基本类型

```rust
fn main() {
    let project = "easy-agent";
    let mut visits = 10;
    let score = 95.5;
    let is_ready = true;

    visits = visits + 5;

    println!("project = {}", project);
    println!("visits = {}", visits);
    println!("score = {}", score);
    println!("is_ready = {}", is_ready);
}
```

你要做的事：
- 自己改变量名
- 自己改数值
- 尝试去掉 `mut` 看会发生什么

---

### 练习 2：写 3 个基础函数
目标：熟悉函数签名和返回值

你自己写这 3 个函数：
1. `add(a, b)`：返回两个整数相加
2. `is_adult(age)`：返回是否成年
3. `say_hello(name)`：返回欢迎语字符串

参考结构：

```rust
fn add(a: i32, b: i32) -> i32 {
    a + b
}

fn is_adult(age: i32) -> bool {
    age >= 18
}

fn say_hello(name: &str) -> String {
    format!("Hello, {}", name)
}

fn main() {
    println!("{}", add(10, 20));
    println!("{}", is_adult(19));
    println!("{}", say_hello("Alice"));
}
```

你要做的事：
- 不要直接复制，自己手敲
- 改函数名和参数名
- 把 `say_hello` 改成中文欢迎语

---

### 练习 3：写一个“个人信息打印器”
目标：把今天的知识串起来

要求：
- 定义姓名、年龄、城市、是否在学 Rust
- 写一个函数生成介绍语
- 使用注释说明你的代码结构

参考思路：

```rust
fn build_intro(name: &str, age: i32, city: &str, learning_rust: bool) -> String {
    format!(
        "我叫 {}，今年 {} 岁，来自 {}，正在学习 Rust：{}",
        name, age, city, learning_rust
    )
}

fn main() {
    let name = "张三";
    let age = 20;
    let city = "厦门";
    let learning_rust = true;

    let intro = build_intro(name, age, city, learning_rust);
    println!("{}", intro);
}
```

---

## 今天要特别注意的概念

### 1. 默认不可变
这是 Rust 的第一道“思维门槛”。

在 JavaScript 里你可能更习惯变量可以随便改，但 Rust 默认要求你明确表达：
- 这个值是不是要改
- 如果要改，就要写 `mut`

这样做的好处是：
- 减少误修改
- 让逻辑更清晰
- 后面和借用规则能更好配合

### 2. 类型写清楚很重要
Rust 的类型系统会让你前期感觉“麻烦”，但后面你会发现它能帮你少踩很多坑。

### 3. 函数签名要读熟
你后面学 Tauri、学 Rust 项目时，会大量看到函数签名。今天先学会看懂这一类：

```rust
fn add(a: i32, b: i32) -> i32
```

它的意思就是：
- 函数名叫 `add`
- 接收两个 `i32`
- 返回一个 `i32`

---

## 和 Java / TS 的对比理解

### 和 Java 比
- Rust 没有你熟悉的 class 起步体验
- 变量默认不可变，这一点更严格
- 函数写法更偏直接和简洁

### 和 TypeScript 比
- Rust 的类型不是“编译辅助”，而是更底层、更严格
- Rust 字符串和可变性更讲究
- 运行前就会拦住很多潜在问题

---

## 今天的最小复盘

学完后，请你自己回答这几个问题：

1. Rust 变量为什么默认不可变？
2. `mut` 是干什么的？
3. `fn add(a: i32, b: i32) -> i32` 这行你能完整解释吗？
4. `String` 和 `&str` 你目前知道了什么？
5. 今天最让你不适应的一点是什么？

把答案写在你的笔记里，不需要很正式。

---

## 今天和 Tauri 的联系

虽然你今天学的是最基础语法，但它们以后在 Tauri 中都会用到：

- 变量：保存状态、配置、返回值
- 函数：写 command、service、工具方法
- 基本类型：和前端交互参数、返回 JSON 数据时经常出现
- 注释：给模块和接口写说明

你可以先建立一个意识：
**你现在学的不是“零散语法”，而是在学未来项目里的基础积木。**

---

## 今日完成标准

如果你满足下面这些，就算今天学得合格：

- 你能自己写出 3 个变量例子
- 你能自己写出 2~3 个简单函数
- 你知道 `mut` 的作用
- 你能解释一个简单函数签名
- 你至少手敲并运行了 2 个例子

---

## 明天预告

明天你会学：
- 表达式与语句
- `if / else`
- `loop / while / for`

明天开始你会慢慢感受到 Rust 一个很重要的特征：
**很多代码块不只是“执行”，还会“产生值”。**
