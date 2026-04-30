# 🎓 学生信息管理系统

基于 **Go + SQLite** 构建的轻量级学校学生信息管理系统，前端使用原生 HTML/CSS/JS。

---

## 功能特性

| 模块 | 功能 |
|------|------|
| 数据总览 | 统计卡片、年级分布柱状图、热门专业排行 |
| 学生档案 | 分页列表展示、多维度筛选搜索、详情弹窗 |
| 档案录入 | 新增 / 编辑 / 删除学生信息 |
| 多维检索 | 学号精确查找 + 姓名/班级/专业模糊搜索 |
| 预留接口 | 成绩登记、课程绑定、健康档案（数据库已建表） |

---

## 快速启动

### 环境要求
- Go 1.21+（需要 CGO，用于 SQLite 驱动）
- GCC / MinGW（Windows 用户需要 CGO 支持）

### 方式一：手动运行
# 1. 删除旧依赖和 vendor 目录
go mod edit -droprequire github.com/mattn/go-sqlite3
rm -rf vendor/

# 2. 拉取新驱动
go get modernc.org/sqlite@v1.34.5
go mod tidy

# 3. 直接编译（无需 GCC，无需 CGO）
go build -o student-system.exe ./cmd/main.go

---

访问：**http://localhost:8080**

### 写入示例数据（可选）
启动服务后，在另一个终端执行：
```bash
go run ./seed/main.go
```
将写入 15 条示例学生数据。

---

## 命令行参数

```
./student-system -addr :8080 -db ./data/students.db
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `-addr` | `:8080` | HTTP 监听地址 |
| `-db` | `./data/students.db` | SQLite 数据库路径 |

---

## 项目结构

```
student-system/
├── cmd/
│   └── main.go              # 程序入口，路由注册
├── internal/
│   ├── db/
│   │   └── db.go            # 数据库初始化、建表
│   ├── models/
│   │   └── student.go       # 数据模型 & CRUD & 查询
│   └── handlers/
│       └── student.go       # HTTP 处理器
├── web/
│   ├── templates/
│   │   └── index.html       # 单页前端入口
│   └── static/
│       ├── css/app.css      # 样式
│       └── js/app.js        # 前端逻辑
├── seed/
│   └── main.go              # 示例数据写入脚本
├── data/                    # 自动创建，存放 .db 文件
├── go.mod
├── Makefile
├── run.sh
└── README.md
```

---

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/students` | 分页搜索（支持多条件） |
| `POST` | `/api/students` | 新增学生 |
| `GET` | `/api/students/:id` | 按学号精确查找 |
| `PUT` | `/api/students/:id` | 更新学生信息 |
| `DELETE` | `/api/students/:id` | 删除学生 |
| `GET` | `/api/stats` | 统计数据 |

### 搜索参数（GET /api/students）
| 参数 | 类型 | 说明 |
|------|------|------|
| `student_id` | string | 学号精确匹配 |
| `name` | string | 姓名模糊搜索 |
| `class` | string | 班级模糊搜索 |
| `major` | string | 专业模糊搜索 |
| `grade` | string | 年级精确筛选 |
| `status` | string | 状态筛选 |
| `page` | int | 页码（默认 1） |
| `page_size` | int | 每页数量（默认 20） |

---

## 数据库表结构

- `students` — 学生基础档案（核心表）
- `grades` — 成绩登记（预留）
- `courses` — 课程信息（预留）
- `health_records` — 健康档案（预留）
