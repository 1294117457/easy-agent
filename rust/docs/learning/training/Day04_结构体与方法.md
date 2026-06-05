# Day 4：结构体与方法（struct / impl）

## 今日目标

今天开始进入 Rust 的业务建模基础。完成今天后，你应该能够：

- 理解 `struct` 是什么
- 知道为什么结构体适合表达业务对象
- 学会使用 `impl` 给结构体定义方法
- 能把一个简单业务对象从 TS/Java 思维迁移到 Rust 写法

建议学习时长：**2.5 小时左右**

建议时间分配：
- 40 分钟：理解概念
- 70 分钟：动手练习
- 40 分钟：复盘与整理

---

## 今天要学什么

### 1. 结构体（struct）

#### 是什么
结构体是 Rust 中用来组织多个相关字段的一种自定义类型。

#### 你要理解的重点
- struct 用于表达“一个完整对象”
- 它适合描述用户、配置、服务、订单、插件等业务实体
- Rust 中结构体是做业务建模的核心工具之一

#### 示例

```rust
struct User {
    name: String,
    age: i32,
    active: bool,
}

fn main() {
    let user = User {
        name: String::from("Alice"),
        age: 20,
        active: true,
    };

    println!("{} {} {}", user.name, user.age, user.active);
}
```

#### 你现在只要记住
- struct 是“多个字段组成的新类型”
- 它比单独散落的变量更适合表达现实业务对象

---

### 2. 结构体实例化

#### 是什么
创建 struct 的具体值时，需要给每个字段赋值。

#### 示例

```rust
struct ServerConfig {
    name: String,
    host: String,
    port: i32,
}

fn main() {
    let config = ServerConfig {
        name: String::from("local-dev"),
        host: String::from("127.0.0.1"),
        port: 8080,
    };

    println!("{} {} {}", config.name, config.host, config.port);
}
```

#### 你要理解的重点
- 结构体字段要一一对应赋值
- 字段名本身就是这个对象的数据结构定义

---

### 3. 方法与 `impl`

#### 是什么
Rust 用 `impl` 为结构体定义方法。

#### 你要理解的重点
- 方法本质上是“属于某个类型的函数”
- `impl` 让数据和行为组织在一起
- 这是你以后写 service model、状态对象时非常常用的方式

#### 示例

```rust
struct User {
    name: String,
    age: i32,
}

impl User {
    fn greet(&self) {
        println!("Hello, {}", self.name);
    }

    fn is_adult(&self) -> bool {
        self.age >= 18
    }
}

fn main() {
    let user = User {
        name: String::from("Tom"),
        age: 19,
    };

    user.greet();
    println!("{}", user.is_adult());
}
```

#### 你现在只要记住
- `&self` 表示“借用当前对象”
- 方法可以读取结构体里的字段
- 后面还会有 `&mut self`，表示可以修改自己

---

### 4. 可变方法 `&mut self`

#### 是什么
如果方法需要修改结构体内部数据，就要用 `&mut self`。

#### 示例

```rust
struct Counter {
    value: i32,
}

impl Counter {
    fn increment(&mut self) {
        self.value += 1;
    }
}

fn main() {
    let mut counter = Counter { value: 0 };
    counter.increment();
    println!("{}", counter.value);
}
```

#### 你要理解的重点
- 对象本身要是 `mut`
- 方法签名要用 `&mut self`
- 这和后面借用规则直接相关

---

## 今天建议你怎么练

### 练习 1：定义一个用户结构体
目标：熟悉 struct 字段定义和实例创建

要求：
- 定义 `User`
- 包含 `name`、`age`、`city`
- 在 `main` 中创建一个实例并打印信息

参考结构：

```rust
struct User {
    name: String,
    age: i32,
    city: String,
}

fn main() {
    let user = User {
        name: String::from("Alice"),
        age: 21,
        city: String::from("Xiamen"),
    };

    println!("{} {} {}", user.name, user.age, user.city);
}
```

---

### 练习 2：给结构体加方法
目标：熟悉 `impl`

要求：
- 给 `User` 增加一个 `intro()` 方法
- 返回一段介绍文字

参考结构：

```rust
struct User {
    name: String,
    age: i32,
}

impl User {
    fn intro(&self) -> String {
        format!("我叫 {}，今年 {} 岁", self.name, self.age)
    }
}

fn main() {
    let user = User {
        name: String::from("Alice"),
        age: 21,
    };

    println!("{}", user.intro());
}
```

---

### 练习 3：定义一个 `ServerConfig`
目标：模拟你未来项目中的真实对象

要求：
- 定义 `ServerConfig`
- 字段包含 `name`、`url`、`enabled`
- 写一个方法 `summary()`，返回配置摘要

参考结构：

```rust
struct ServerConfig {
    name: String,
    url: String,
    enabled: bool,
}

impl ServerConfig {
    fn summary(&self) -> String {
        format!("name: {}, url: {}, enabled: {}", self.name, self.url, self.enabled)
    }
}

fn main() {
    let config = ServerConfig {
        name: String::from("mcp-local"),
        url: String::from("http://localhost:3000"),
        enabled: true,
    };

    println!("{}", config.summary());
}
```

---

### 练习 4：写一个可变方法
目标：熟悉 `&mut self`

要求：
- 定义一个 `Task`
- 字段有 `title` 和 `finished`
- 写一个 `mark_done()` 方法，把 `finished` 改成 `true`

参考结构：

```rust
struct Task {
    title: String,
    finished: bool,
}

impl Task {
    fn mark_done(&mut self) {
        self.finished = true;
    }
}

fn main() {
    let mut task = Task {
        title: String::from("Learn Rust"),
        finished: false,
    };

    task.mark_done();
    println!("{} {}", task.title, task.finished);
}
```

---

## 今天要特别注意的概念

### 1. struct 不是 class，但也能建模对象
你有 Java 基础，可能会自然想把 struct 当 class 看。

可以先这么理解：
- struct 负责承载数据
- `impl` 负责给数据定义行为

但 Rust 没有传统 OOP 的那一整套 class 起点思维。

### 2. `&self` 表示借用当前对象
当你写：

```rust
fn intro(&self) -> String
```

意思是：
- 这个方法只读当前对象
- 不拿走所有权
- 不修改对象本身

### 3. `&mut self` 表示允许修改当前对象
这和你后面学借用会更强关联。

---

## 和 Java / TS 的对比理解

### 和 Java 比
- Java 更像 `class + field + method`
- Rust 更像 `struct + impl`
- 没有强依赖继承式起手思维

### 和 TypeScript 比
- TS 中对象更灵活
- Rust 中 struct 更严格、更清晰
- Rust 的字段类型和修改权限更明确

---

## 今天的最小复盘

请你自己回答：

1. struct 是用来做什么的？
2. 为什么说它适合业务建模？
3. `impl` 的作用是什么？
4. `&self` 和 `&mut self` 有什么区别？
5. 如果你要表达一个 MCP server，可能会有哪些字段？

---

## 今天和 Tauri 的联系

你后面做 Tauri + Rust 重构时，会大量写这样的结构：

- `ServerConfig`
- `PluginInfo`
- `WorkflowNode`
- `UserSettings`
- `AppState`

这些几乎都应该优先建模成 `struct` 或 `enum`。

所以今天这部分不是普通语法点，而是你后续项目 Rust 化的入口。

---

## 今日完成标准

如果你满足下面这些，就算今天学得合格：

- 你能定义 2 个结构体
- 你能给结构体写至少 2 个方法
- 你能区分 `&self` 和 `&mut self`
- 你能写一个修改字段值的方法
- 你至少手敲运行了 3 个例子

---

## 明天预告

明天你会进入 Rust 最核心的概念之一：
- 所有权（ownership）

这是 Rust 最重要、也最容易让初学者卡住的部分。你不用急着“完全掌握”，但要开始建立正确思维。