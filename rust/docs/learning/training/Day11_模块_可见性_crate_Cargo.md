# Day 11：模块、可见性、crate 与 Cargo

## 今日目标

今天你要从“会写单文件 Rust”进入“开始理解 Rust 项目怎么组织”。完成今天后，你应该能够：

- 知道模块 `mod` 是干什么的
- 理解 `pub` 的作用
- 对 crate 有基础认知
- 知道 Cargo 在 Rust 工程中的核心地位

建议学习时长：**2.5 小时左右**

建议时间分配：
- 45 分钟：概念理解
- 60 分钟：观察结构与写示例
- 45 分钟：复盘整理

---

## 今天要学什么

### 1. 模块（mod）是什么

#### 核心直觉
模块是 Rust 用来组织代码的方式。它的作用类似“把相关代码放进一个命名空间里”，避免所有内容都堆在一个文件中。

#### 为什么重要
当项目一大，你不可能把：
- 所有结构体
- 所有函数
- 所有配置逻辑
- 所有数据库逻辑

都写在一个文件里。

所以模块的作用就是：
- 分类组织代码
- 降低混乱
- 让项目更易维护

#### 示例

```rust
mod math {
    pub fn add(a: i32, b: i32) -> i32 {
        a + b
    }
}

fn main() {
    let result = math::add(2, 3);
    println!("{}", result);
}
```

---

### 2. `pub` 是什么

#### 核心直觉
Rust 默认很多东西是私有的。`pub` 用来表示“这个东西可以被外部访问”。

#### 你要理解的重点
- 不写 `pub`，模块外通常不能访问
- `pub` 是 Rust 做封装和边界控制的重要方式

#### 示例

```rust
mod user_service {
    pub fn get_name() -> String {
        String::from("Alice")
    }

    fn secret() -> String {
        String::from("hidden")
    }
}

fn main() {
    println!("{}", user_service::get_name());
    // println!("{}", user_service::secret());
}
```

#### 你现在只要记住
- `pub` 决定“外面能不能用”
- 这是大型项目里非常重要的边界工具

---

### 3. 结构体字段也有可见性

#### 示例

```rust
mod models {
    pub struct User {
        pub name: String,
        age: i32,
    }
}

fn main() {
    let user = models::User {
        name: String::from("Tom"),
        // age: 20,
    };

    println!("{}", user.name);
}
```

#### 你要理解的重点
- `struct` 本身可见，不代表字段全都可见
- Rust 会把封装做得更细

---

### 4. crate 是什么

#### 核心直觉
crate 可以先粗略理解成：**Rust 的一个编译单元 / 项目单元**。

#### 你现在先这样理解就够了
- 一个 Rust 可执行程序可以是一个 crate
- 一个 Rust 库也可以是一个 crate
- 你以后看到 `crate::xxx`，可以先理解为“从当前项目根开始找”

#### 为什么要有 crate 概念
因为 Rust 不只是写一个文件，它的工程体系希望你能：
- 拆模块
- 拆库
- 管理依赖
- 清晰组织大型代码库

---

### 5. Cargo 是什么

#### 核心直觉
Cargo 是 Rust 的构建和包管理工具，它几乎是 Rust 工程开发的入口。

#### 它负责什么
- 创建项目
- 编译项目
- 运行项目
- 管理依赖
- 执行测试
- 构建发布版本

#### 常见命令概念
- `cargo new`：创建项目
- `cargo run`：运行项目
- `cargo build`：编译项目
- `cargo check`：只检查不生成最终产物

你今天不一定要全背，但要知道 Cargo 是 Rust 工程化的核心。

---

## 今天建议你怎么练

### 练习 1：在单文件中写一个简单模块
目标：熟悉 `mod + pub`

```rust
mod config {
    pub fn app_name() -> String {
        String::from("easy-agent")
    }
}

fn main() {
    println!("{}", config::app_name());
}
```

你要做的事：
- 改模块名
- 改函数名
- 增加一个不带 `pub` 的函数并观察它为什么不能在外面调用

---

### 练习 2：定义带可见性控制的结构体
目标：理解 `pub struct` 和 `pub field`

```rust
mod models {
    pub struct Server {
        pub name: String,
        pub enabled: bool,
    }
}

fn main() {
    let server = models::Server {
        name: String::from("mcp-local"),
        enabled: true,
    };

    println!("{} {}", server.name, server.enabled);
}
```

你要做的事：
- 再新增一个字段不写 `pub`
- 思考：为什么有些字段应该公开，有些不应该公开

---

### 练习 3：设计一个简单项目分层草图
目标：开始建立工程结构意识

请你先不用真正多文件实现，只写出你觉得一个 Tauri/Rust 项目可能有哪些模块：
- `models`
- `services`
- `storage`
- `commands`
- `config`

思考每个模块可能负责什么。

---

### 练习 4：理解 `crate::` 的感觉
目标：对项目根作用域有初步认知

今天你不必追求完全掌握 `crate::` 路径写法，但你要知道：
- 它通常表示“从当前 crate 根部找路径”
- 后面看别人的 Rust 项目时，这个很常见

你可以先写下一个简单认知句：

> `crate::` 很像从当前项目根命名空间开始找模块。

---

### 练习 5：观察 Cargo 的角色
目标：建立工程工具意识

今天即使你不实际操作，也请你记下：
- Cargo 不只是“运行工具”
- 它是 Rust 工程管理的中枢

你可以在笔记里整理：
- 为什么 Rust 项目离不开 Cargo
- 它和 Node 的包管理、Java 的构建工具有哪些相似之处

---

## 今天要特别注意的概念

### 1. Rust 默认更偏“私有”
这和很多语言默认更开放的感觉不太一样。

Rust 的思路是：
- 先收紧
- 需要暴露时再显式开放

这会让大型项目更容易保持边界清晰。

### 2. 模块不只是“拆文件”，更是“拆职责”
真正有价值的模块划分，不是随便分文件，而是根据职责组织代码。

### 3. Cargo 是 Rust 工程感的入口
你以后一旦真正进入 Tauri 项目，Cargo 会变成你几乎每天都接触的核心工具。

---

## 和 Java / TS 的对比理解

### 和 Java 比
- 有点像 package + public/private 的结合，但组织方式不同
- Rust 更强调模块边界和可见性显式控制

### 和 TypeScript 比
- TS 文件系统模块更自由，Rust 模块体系更明确、更受约束
- Rust 的 `pub` 边界意识更强

---

## 今日小任务：做一个“迷你项目结构设计”

要求：
请你想象自己要做一个 Tauri 后端 core，列出 5 个模块，并写下每个模块职责，比如：
- `models`：数据结构
- `services`：业务逻辑
- `storage`：持久化
- `commands`：前端调用入口
- `config`：配置读取与校验

这不是代码练习，而是工程思维练习。

---

## 今天的最小复盘

请你自己回答：

1. 模块的核心作用是什么？
2. 为什么 Rust 默认不随便公开？
3. `pub` 解决什么问题？
4. crate 可以先粗略理解成什么？
5. Cargo 在 Rust 项目里为什么如此重要？

---

## 今天和 Tauri 的联系

你以后做 Tauri + Rust 重构时，一定会面临这些问题：
- command 放哪
- model 放哪
- 存储层放哪
- 配置解析放哪
- 业务逻辑放哪

也就是说，从今天开始，你学习的不只是语法，而是项目结构思维。

---

## 今日完成标准

如果你满足下面这些，就算今天学得合格：

- 你能写一个简单模块并通过路径调用函数
- 你理解 `pub` 的基本作用
- 你知道 struct 字段也能控制可见性
- 你对 crate 和 Cargo 有初步概念
- 你能画出一个简单 Rust 项目模块草图

---

## 明天预告

明天你会学：
- trait
- 泛型
- derive

这会带你开始进入 Rust 的抽象能力和代码复用能力。