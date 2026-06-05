# Day 10：集合类型（Vec / HashMap）

## 今日目标

今天你会学习 Rust 中最常用的两类集合：`Vec<T>` 和 `HashMap<K, V>`。完成今天后，你应该能够：

- 理解 `Vec` 和数组的区别
- 学会创建、追加、遍历 `Vec`
- 学会创建、插入、读取 `HashMap`
- 用集合组织更接近真实业务的数据

建议学习时长：**2 小时左右**

建议时间分配：
- 35 分钟：概念理解
- 55 分钟：动手练习
- 30 分钟：复盘整理

---

## 今天要学什么

### 1. `Vec<T>` 是什么

#### 核心直觉
`Vec<T>` 是 Rust 中最常用的动态数组，也就是**长度可以变化的同类型集合**。

#### 和数组的区别
- 数组：长度固定
- `Vec<T>`：长度可变

#### 示例

```rust
fn main() {
    let mut tools = Vec::new();
    tools.push(String::from("Rust"));
    tools.push(String::from("Tauri"));
    tools.push(String::from("Vue"));

    println!("{:?}", tools);
}
```

#### 你要理解的重点
- `Vec` 很适合存储列表数据
- 你以后处理 server 列表、插件列表、工作流节点列表时会经常用到它

---

### 2. 遍历 `Vec`

#### 示例

```rust
fn main() {
    let tools = vec!["Rust", "Tauri", "Vue"];

    for tool in tools {
        println!("{}", tool);
    }
}
```

#### 你要理解的重点
- `vec![]` 是快速创建向量的常用方式
- `for` 搭配 `Vec` 是最常见写法之一

---

### 3. 读取 `Vec` 中的元素

#### 示例

```rust
fn main() {
    let nums = vec![10, 20, 30];

    let first = &nums[0];
    println!("{}", first);
}
```

#### 你要理解的重点
- 用索引可以访问元素
- 访问时会涉及引用和借用
- 后面你会逐步更熟悉这些细节

---

### 4. `HashMap<K, V>` 是什么

#### 核心直觉
`HashMap` 是键值对集合，适合表达“根据 key 查 value”的数据关系。

#### 示例

```rust
use std::collections::HashMap;

fn main() {
    let mut ports = HashMap::new();
    ports.insert(String::from("http"), 80);
    ports.insert(String::from("https"), 443);

    println!("{:?}", ports);
}
```

#### 你要理解的重点
- `HashMap` 很适合配置映射、状态映射、索引查找
- 项目里常见的“名称 -> 值”关系都适合它

---

### 5. 从 `HashMap` 读取值

#### 示例

```rust
use std::collections::HashMap;

fn main() {
    let mut settings = HashMap::new();
    settings.insert(String::from("theme"), String::from("dark"));

    match settings.get("theme") {
        Some(value) => println!("theme = {}", value),
        None => println!("not found"),
    }
}
```

#### 你要理解的重点
- `get` 返回的是 `Option`
- 因为某个 key 可能不存在
- 这说明 Rust 会强制你处理“查不到”的情况

---

## 今天建议你怎么练

### 练习 1：创建并追加 `Vec`
目标：熟悉动态数组

要求：
- 创建一个 `Vec<String>`
- 依次加入 3~5 个你要学习的技术名
- 打印整个列表

参考结构：

```rust
fn main() {
    let mut skills = Vec::new();
    skills.push(String::from("Rust"));
    skills.push(String::from("Tauri"));
    skills.push(String::from("SQLite"));

    println!("{:?}", skills);
}
```

---

### 练习 2：遍历 `Vec`
目标：熟悉列表遍历

```rust
fn main() {
    let tools = vec!["Rust", "Tauri", "Vue"];

    for tool in tools {
        println!("正在学习：{}", tool);
    }
}
```

你要做的事：
- 改成遍历你的学习计划项目
- 输出更完整的句子

---

### 练习 3：定义一个 `Vec<struct>`
目标：让集合和业务对象结合

要求：
- 定义一个 `Server` 结构体
- 创建一个 `Vec<Server>`
- 放入 2~3 个 server
- 遍历输出每个 server 信息

参考结构：

```rust
struct Server {
    name: String,
    enabled: bool,
}

fn main() {
    let servers = vec![
        Server {
            name: String::from("mcp-local"),
            enabled: true,
        },
        Server {
            name: String::from("mcp-remote"),
            enabled: false,
        },
    ];

    for server in servers {
        println!("{} {}", server.name, server.enabled);
    }
}
```

---

### 练习 4：创建并使用 `HashMap`
目标：熟悉键值映射

要求：
- 创建一个 `HashMap<String, String>`
- 存储 3 个配置项，例如 `theme`、`lang`、`mode`
- 读取其中一个值

参考结构：

```rust
use std::collections::HashMap;

fn main() {
    let mut settings = HashMap::new();
    settings.insert(String::from("theme"), String::from("dark"));
    settings.insert(String::from("lang"), String::from("zh-CN"));
    settings.insert(String::from("mode"), String::from("dev"));

    match settings.get("theme") {
        Some(value) => println!("{}", value),
        None => println!("not found"),
    }
}
```

---

### 练习 5：做一个“学习资源管理器”
目标：综合使用 `Vec` 和 `HashMap`

要求：
- 用 `Vec` 存储学习主题列表
- 用 `HashMap` 存储某个主题对应的难度
- 打印所有学习主题
- 查询某个主题的难度

---

## 今天要特别注意的概念

### 1. `Vec` 比数组更适合业务开发
实际项目中，数据长度经常不是固定的，所以你会更常用 `Vec`。

### 2. `HashMap::get` 返回 `Option`
这说明 Rust 不会假设 key 一定存在。

### 3. 集合和借用会逐渐结合起来
你后面会越来越常见：
- 从集合中借一个值
- 遍历时读取或修改元素
- 结合 `Option` / `Result` 处理查找结果

---

## 和 Java / TS 的对比理解

### 和 Java 比
- `Vec<T>` 有点像 `ArrayList<T>`
- `HashMap<K, V>` 概念上和 Java 类似
- 但 Rust 会更严格地处理借用和可变性

### 和 TypeScript 比
- `Vec<T>` 类似数组，但更明确类型和所有权语义
- `HashMap` 和对象/Map 类似，但返回值处理更显式

---

## 今日小任务：做一个“服务器列表与设置表”

要求：
- 用 `Vec` 存 3 个 server 名字
- 用 `HashMap` 存储每个设置项
- 打印全部 server
- 查询一个设置项

目标：
让你开始习惯“集合 + 业务数据”的组合方式。

---

## 今天的最小复盘

请你自己回答：

1. 数组和 `Vec` 的区别是什么？
2. 为什么项目里通常更常用 `Vec`？
3. `HashMap` 适合什么场景？
4. 为什么 `get` 返回 `Option`？
5. 你今天更常用的是列表思维还是映射思维？

---

## 今天和 Tauri 的联系

你未来做 Tauri + Rust 时，会非常频繁使用：
- `Vec<ServerConfig>`
- `Vec<PluginInfo>`
- `Vec<WorkflowNode>`
- `HashMap<String, String>` 配置表
- `HashMap<String, Status>` 状态索引

所以今天学的不是普通容器，而是后面项目数据组织的核心工具。

---

## 今日完成标准

如果你满足下面这些，就算今天学得合格：

- 你能创建并遍历 `Vec`
- 你能创建并读取 `HashMap`
- 你能理解 `HashMap::get` 为什么返回 `Option`
- 你至少手敲运行了 4 个例子
- 你能把 `Vec` 或 `HashMap` 用在一个简单业务对象场景里

---

## 明天预告

明天你会学：
- 模块 `mod`
- 可见性 `pub`
- crate 和项目组织
- Cargo 的基础使用

这会让你开始从“会写单文件代码”进入“会组织项目结构”。