
下面是一份简洁明了的 **Go（Golang）语言入门简介**，适合有一定编程基础的新手快速上手。

---

## 🚀 什么是 Go 语言？

* **Go（Golang）** 是 Google 开发的现代编程语言
* 强调：**简洁、高性能、并发支持**
* 适合构建：**高性能 Web 后端、微服务、工具程序、CLI、网络服务**

---

## 🧠 Go 的核心特点

| 特点    | 说明                                           |
| ----- | -------------------------------------------- |
| 编译型语言 | 编译为机器码，启动速度快                                 |
| 静态类型  | 类型检查明确，编译时发现错误                               |
| 内存安全  | 自动垃圾回收                                       |
| 并发支持强 | 内置 `goroutine` 和 `channel`                   |
| 语法简洁  | 类似 C，但没有头文件和类                                |
| 内置工具链 | 格式化（`gofmt`）、构建（`go build`）、测试（`go test`）都自带 |

---

## ✅ Go 安装与运行

### 安装：

* 官网下载：[https://go.dev/dl/](https://go.dev/dl/)
* 配置好环境变量 `GOROOT`（安装路径）和 `GOPATH`（工作区）

### 创建并运行 Hello World：

#### 1. 创建文件：`hello.go`

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, Go!")
}
```

#### 2. 运行：

```bash
go run hello.go
```

#### 3. 编译成可执行程序：

```bash
go build hello.go
./hello      # Windows 下是 hello.exe
```

---

## ✏️ 基本语法简介

### 1. 变量定义

```go
var name string = "Go"
age := 10 // 类型自动推断
```

### 2. 函数

```go
func add(a int, b int) int {
    return a + b
}
```

### 3. 控制结构

```go
for i := 0; i < 5; i++ {
    fmt.Println(i)
}

if x > 0 {
    fmt.Println("positive")
}
```

### 4. 数组与切片

```go
arr := [3]int{1, 2, 3}
slice := []string{"a", "b", "c"}
```

### 5. 结构体

```go
type User struct {
    Name string
    Age  int
}

u := User{"Alice", 20}
```

### 6. Map（字典）

```go
m := map[string]int{"a": 1, "b": 2}
fmt.Println(m["a"])
```

### 7. 并发（goroutine）

```go
go func() {
    fmt.Println("running in goroutine")
}()
```

---

## 🧰 Go 常用命令

| 命令                | 说明                 |
| ----------------- | ------------------ |
| `go run`          | 运行 Go 文件           |
| `go build`        | 编译可执行文件            |
| `go mod init xxx` | 初始化 Go Module（包管理） |
| `go get`          | 获取远程依赖             |
| `go fmt`          | 自动格式化代码            |
| `go test`         | 单元测试               |

---

## 📚 推荐学习路线

1. **基础语法学习**：变量、控制结构、函数、指针、结构体、接口等
2. **标准库应用**：如 `fmt`, `net/http`, `os`, `io` 等
3. **并发模型**：`goroutine`, `channel`，理解 CSP 模型
4. **项目实战**：构建 REST API、CLI 工具、小型爬虫等
5. **深入理解**：内存管理、错误处理、模块管理、性能优化

---

## 🔗 推荐资源

* 📘 官方教程：[https://go.dev/learn/](https://go.dev/learn/)
* 📘 Go by Example：[https://gobyexample.com/](https://gobyexample.com/)
* 📘 Tour of Go：[https://go.dev/tour](https://go.dev/tour)
* 📘 中文文档：[https://learnku.com/docs/golang](https://learnku.com/docs/golang)

---

## ✅ 总结一句话：

> **Go 是一门工程效率极高的语言，适合后端服务和系统工具开发，语法简洁、性能强大。**


---

**介绍Go：（1）Gin（轻量高性能）、（2）Fiber（Express 风格，学习快）；**

Gin 和 Fiber 都是 Go 语言中非常流行的 Web 框架，它们都主打 高性能、轻量化，但是设计理念、上手体验有一些差别。

一、Gin：定位：轻量、高性能的 HTTP Web 框架，Go 里最火的框架之一。

特点：
- 高性能：基于 httprouter，路由性能非常快。
- 简洁 API：封装了常用功能（路由、中间件、JSON 处理、表单绑定、验证等）。
- 中间件机制：支持链式中间件，方便扩展。
- 生态活跃：社区成熟，资料多，适合生产环境。

代码示例：
```
package main

import (
    "github.com/gin-gonic/gin"
)

func main() {
    r := gin.Default()

    r.GET("/ping", func(c *gin.Context) {
        c.JSON(200, gin.H{
            "message": "pong",
        })
    })

    r.Run(":8080") // 启动服务
}
```
👉 打开浏览器访问 http://localhost:8080/ping，返回 {"message":"pong"}

适用场景：有 Web 开发经验，想要高性能、功能全的框架。适合中大型项目、生产环境。

二、Fiber：定位：受 Node.js Express.js 启发的 Go Web 框架，语法非常简洁，上手快。

特点：
- 语法类似 Express：对前端/Node.js 开发者很友好。
- 高性能：基于 fasthttp（比 Go 内置 net/http 更快）。
- 学习成本低：API 设计简洁，像写 Node.js Express。
- 内置丰富功能：路由分组、静态文件服务、模板渲染、WebSocket 等。

代码示例：
```
package main

import "github.com/gofiber/fiber/v2"

func main() {
    app := fiber.New()

    app.Get("/ping", func(c *fiber.Ctx) error {
        return c.JSON(fiber.Map{
            "message": "pong",
        })
    })

    app.Listen(":8080")
}
```
👉 一样可以访问 http://localhost:8080/ping，效果与 Gin 类似。

适用场景：前端/Node.js 转 Go 的开发者（语法风格接近 Express）。适合快速开发、小中型应用、API 服务。

📊 Gin vs Fiber 对比表
| 特性    | Gin                       | Fiber                     |
| ----- | ------------------------- | ------------------------- |
| 底层依赖  | `net/http` + `httprouter` | `fasthttp`（更快，但兼容性稍弱）     |
| 性能    | 很快（接近原生 net/http）         | 更快（fasthttp 优势）           |
| 学习曲线  | 中等，需要理解 Gin 的上下文和中间件      | 简单，上手快，尤其对 Express 用户友好   |
| 功能封装  | 内置中间件丰富，生态成熟              | 内置功能多，但生态相对年轻             |
| 社区与生态 | 超大社区，文档/教程丰富              | 较新兴，社区活跃但规模比 Gin 小        |
| 适用场景  | 中大型项目，生产级 REST API        | 快速开发、小型服务、前端熟悉 Express 的人 |

