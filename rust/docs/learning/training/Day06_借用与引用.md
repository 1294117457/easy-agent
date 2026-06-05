# Day 6：借用与引用（Borrowing / Reference）

## 今日目标

昨天你学了所有权，今天要学的是 Rust 为了“避免频繁转移所有权”而提供的关键机制：**借用**。完成今天后，你应该能够：

- 理解什么是引用 `&T`
- 理解什么是可变引用 `&mut T`
- 知道借用和所有权转移的区别
- 知道为什么 Rust 不允许同时随意修改和读取同一份数据

建议学习时长：**3 小时左右**

建议时间分配：
- 50 分钟：理解概念
- 80 分钟：反复写例子
- 30 分钟：复盘与整理

---

## 今天要学什么

### 1. 借用是什么

#### 核心直觉
如果你只是想“临时使用某个值”，而不想拿走它的所有权，就可以借用它。

#### 最常见的形式
- `&T`：不可变引用，只读借用
- `&mut T`：可变引用，可修改借用

#### 你要理解的重点
- 借用不等于复制
- 借用也不等于转移所有权
- 借用更像“我先用一下，用完还给你”

---

### 2. 不可变引用 `&T`

#### 示例

```rust
fn print_name(name: &String) {
    println!("{}", name);
}

fn main() {
    let project = String::from("easy-agent");
    print_name(&project);
    println!("{}", project);
}
```

#### 你要理解的重点
- `print_name` 没有拿走 `project` 的所有权
- 它只是借来看了一下
- 所以函数调用结束后，`project` 还可以继续用

#### 直觉理解
昨天是“把东西交出去”，今天是“只是给别人看一下”。

---

### 3. 可变引用 `&mut T`

#### 示例

```rust
fn append_text(text: &mut String) {
    text.push_str(" + Rust");
}

fn main() {
    let mut title = String::from("Learning");
    append_text(&mut title);
    println!("{}", title);
}
```

#### 你要理解的重点
- 如果要通过引用修改值，必须用 `&mut`
- 原变量本身也必须是 `mut`
- 这是 Rust 对“谁有资格修改数据”的强约束

---

### 4. 借用规则

Rust 的借用规则非常重要。你今天先记住这几条：

1. 同一时刻可以有多个不可变引用
2. 同一时刻只能有一个可变引用
3. 可变引用和不可变引用不能同时存在

#### 为什么这样设计
因为 Rust 要避免“一个地方在改，另一个地方还在读”导致的数据竞争和混乱状态。

---

### 5. 多个不可变借用

#### 示例

```rust
fn main() {
    let name = String::from("Rust");

    let r1 = &name;
    let r2 = &name;

    println!("{} {}", r1, r2);
}
```

#### 你要理解的重点
- 多个人同时“看”一份数据没问题
- 因为没有人修改它

---

### 6. 只能有一个可变借用

#### 示例

```rust
fn main() {
    let mut name = String::from("Rust");

    let r1 = &mut name;
    r1.push_str(" Language");

    println!("{}", r1);
}
```

#### 你要理解的重点
- 同一时间只能有一个“修改权限持有者”
- 这样更安全、更清晰

---

### 7. 可变借用与不可变借用不能同时出现

#### 错误思路示例

```rust
fn main() {
    let mut name = String::from("Rust");

    let r1 = &name;
    let r2 = &mut name;

    println!("{} {}", r1, r2);
}
```

#### 你要理解的重点
- 一个地方在读，一个地方又想改，Rust 会直接阻止
- 这类限制会让你前期不习惯，但它是 Rust 安全性的关键来源之一

---

## 今天建议你怎么练

### 练习 1：借用而不是转移所有权
目标：对比昨天的 move 和今天的借用

```rust
fn show_project(name: &String) {
    println!("project = {}", name);
}

fn main() {
    let project = String::from("easy-agent");
    show_project(&project);
    println!("still can use: {}", project);
}
```

你要做的事：
- 把参数改成 `String` 看区别
- 对比两种写法，写出你自己的总结

---

### 练习 2：可变借用修改字符串
目标：熟悉 `&mut`

```rust
fn update_status(status: &mut String) {
    status.push_str("-connected");
}

fn main() {
    let mut server_status = String::from("mcp");
    update_status(&mut server_status);
    println!("{}", server_status);
}
```

你要做的事：
- 改成往字符串前后追加不同内容
- 解释为什么函数参数和调用处都要写 `mut`

---

### 练习 3：多个不可变引用
目标：理解“多个读”是允许的

```rust
fn main() {
    let title = String::from("Learning Rust");

    let a = &title;
    let b = &title;
    let c = &title;

    println!("{} | {} | {}", a, b, c);
}
```

你要做的事：
- 自己再多加一个引用
- 用自己的话解释：为什么这样没问题

---

### 练习 4：制造一个借用冲突错误
目标：主动感受借用规则

请尝试写出下面这种结构：

```rust
fn main() {
    let mut text = String::from("hello");

    let r1 = &text;
    let r2 = &mut text;

    println!("{} {}", r1, r2);
}
```

你要做的事：
- 观察编译器报错
- 写下你对报错的理解
- 再想办法修改代码，让它能编译通过

---

### 练习 5：做一个“配置更新器”
目标：把借用用于一个接近业务的场景

要求：
- 定义一个 `String` 作为配置名称
- 写一个只读函数打印名称
- 写一个修改函数追加 `-dev`
- 在 `main` 中按顺序调用

参考结构：

```rust
fn print_config(name: &String) {
    println!("config = {}", name);
}

fn mark_dev(name: &mut String) {
    name.push_str("-dev");
}

fn main() {
    let mut config_name = String::from("mcp-local");

    print_config(&config_name);
    mark_dev(&mut config_name);
    print_config(&config_name);
}
```

---

## 今天要特别注意的概念

### 1. 借用解决了“我不想交出所有权”的问题
这正是你昨天自然会遇到的疑问：

> 只是打印一下，为什么要把整个 String 交出去？

借用就是答案。

### 2. `&self` 和 `&mut self` 的底层思想和今天是一致的
你昨天学 struct 方法时看到的：
- `&self`
- `&mut self`

本质上就是对当前对象进行借用。

### 3. Rust 的限制不是在故意为难你
它是在提前阻止潜在问题：
- 数据竞争
- 不一致状态
- 同时读写冲突

---

## 和 Java / TS 的对比理解

### 和 Java 比
- Java 里对象引用传来传去更自然，但也更容易隐藏共享修改问题
- Rust 把“读”和“改”的权限界限写得更清楚

### 和 TypeScript 比
- TS 中对象引用共享很常见，但默认缺少编译期约束
- Rust 会更严格地限制你什么时候能读、什么时候能改

---

## 今日小任务：做一个“用户名编辑器”

要求：
- 创建一个用户名 `String`
- 写一个函数只读打印用户名
- 写一个函数把用户名后面加上 `_vip`
- 修改后再次打印
- 再尝试同时创建只读引用和可变引用，观察报错

你的目标不是逃避报错，而是**理解报错为什么发生**。

---

## 今天的最小复盘

请你自己回答：

1. 借用和所有权转移有什么区别？
2. `&String` 和 `&mut String` 有什么区别？
3. 为什么多个不可变借用是允许的？
4. 为什么可变借用和不可变借用不能同时存在？
5. 今天你最容易写错的地方是什么？

---

## 今天和 Tauri 的联系

你以后做 Tauri + Rust 时，会经常遇到这类场景：
- 一个函数只读取配置
- 一个函数修改状态
- 一个方法读取对象字段
- 一个方法更新连接状态

这些几乎都绕不开借用设计。

所以你今天学的是以后写：
- command
- service
- config parser
- state updater

时都会反复出现的基础模式。

---

## 今日完成标准

如果你满足下面这些，就算今天学得合格：

- 你能解释借用和 move 的区别
- 你能写出 `&T` 和 `&mut T` 的例子
- 你能说出三条基础借用规则
- 你故意制造并理解过至少 1 个借用冲突报错
- 你至少手敲运行了 4 个例子

---

## 明天预告

明天你会学：
- 枚举 `enum`
- 模式匹配 `match`

这会让你开始真正感受到 Rust 在“状态建模”上的强大之处。