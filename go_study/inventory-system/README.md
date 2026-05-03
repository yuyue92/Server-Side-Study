# 公司内部库存管理系统

Go + SQLite 实现的库存管理系统，核心保证库存数据绝对准确，通过乐观锁防止高并发超卖。

## 快速启动

### 环境要求

- Go 1.22+
- GCC（编译 CGO/SQLite 需要）
  - Linux: `apt-get install gcc`
  - macOS: `xcode-select --install`
  - Windows: 安装 [TDM-GCC](https://jmeubank.github.io/tdm-gcc/)

### 编译运行

```bash
# 1. 克隆 / 解压项目
cd inventory

# 2. 配置本地 SQLite 驱动（若无法访问 proxy.golang.org）
#    直接使用 go get（需要网络）：
go mod tidy

#    或使用本机系统包（Ubuntu/Debian）：
# apt-get install golang-github-mattn-go-sqlite3-dev
# go mod edit -replace github.com/mattn/go-sqlite3=/usr/share/gocode/src/github.com/mattn/go-sqlite3
# go mod tidy

# 3. 编译
CGO_ENABLED=1 go build -o inventory_server .

# 4. 启动
./inventory_server
# 输出：🚀 库存管理系统启动，监听端口 :8080
```

### 环境变量

| 变量          | 默认值           | 说明               |
|-------------|--------------|------------------|
| SERVER_PORT | 8080         | HTTP 监听端口         |
| DB_PATH     | ./inventory.db | SQLite 数据库文件路径   |
| LOG_LEVEL   | info         | 日志级别             |

```bash
SERVER_PORT=9090 DB_PATH=/data/inv.db ./inventory_server
```

---

## API 文档

### 统一响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

错误时 `code` 非 0，`message` 为错误描述。

---

### 商品管理

#### 创建商品
```
POST /api/products
```
```json
{
  "name": "农夫山泉矿泉水",
  "spec": "550ml/瓶",
  "price": 2.5,
  "initial_stock": 100,
  "warning_threshold": 10
}
```

#### 商品列表
```
GET /api/products?keyword=矿泉&page=1&page_size=20
```

#### 商品详情
```
GET /api/products/{id}
```

#### 更新商品信息（支持部分更新）
```
PUT /api/products/{id}
```
```json
{
  "price": 3.0,
  "warning_threshold": 15
}
```

#### 删除商品（软删除）
```
DELETE /api/products/{id}
```

---

### 库存操作

所有操作均：事务保证原子性 + 乐观锁防超卖 + 自动写流水

#### 入库
```
POST /api/stock/in
```
```json
{
  "product_id": 1,
  "quantity": 100,
  "remark": "采购单 PO-2024001",
  "operator": "张三"
}
```

#### 出库
```
POST /api/stock/out
```
```json
{
  "product_id": 1,
  "quantity": 10,
  "remark": "销售订单 SO-2024001",
  "operator": "李四"
}
```

#### 损耗登记
```
POST /api/stock/loss
```
```json
{
  "product_id": 1,
  "quantity": 2,
  "remark": "破损处理",
  "operator": "王五"
}
```

---

### 流水查询

```
GET /api/logs?product_id=1&change_type=OUT&start_time=2024-01-01&end_time=2024-12-31&page=1&page_size=50
```

| 参数          | 说明                        |
|-------------|---------------------------|
| product_id  | 商品 ID（可选，不传则查全部）          |
| change_type | IN / OUT / LOSS（可选）        |
| start_time  | 开始时间，格式 `2024-01-01`（可选） |
| end_time    | 结束时间（可选）                  |
| page        | 页码，默认 1                   |
| page_size   | 每页数量，默认 50，最大 200         |

---

### 预警管理

#### 预警列表
```
GET /api/warnings?only_unresolved=true&page=1&page_size=20
```

#### 标记预警已处理
```
PUT /api/warnings/{id}/resolve
```

---

### 健康检查
```
GET /health
→ {"status":"ok"}
```

---

## 架构说明

```
main.go           路由注册、依赖组装、优雅关闭
config/           环境变量配置加载
db/               SQLite 初始化（WAL 模式、PRAGMA、DDL）
model/            数据结构 + 请求 DTO
repository/       纯 SQL 封装（无业务逻辑）
  product_repo    商品 CRUD + 乐观锁 UPDATE
  log_repo        流水 append-only 写入 + 联查
  warning_repo    预警记录 CRUD
service/          业务逻辑层
  product_service 商品增删改查
  stock_service   核心：事务 + 乐观锁扣减 + 异步预警触发
  warning_service 预警列表 + 标记处理
handler/          HTTP 层：请求解析、参数校验、响应格式化
pkg/
  response/       统一 JSON 响应
  notify/         通知适配器（默认日志，可扩展为钉钉/邮件）
cmd/test/         集成自检测试（36 用例）
```

## 防超卖机制

### 乐观锁流程

```
1. 事务内 SELECT（含 version 字段）
2. 业务校验：stock < qty → 直接返回"库存不足"
3. 带版本号 UPDATE：
   WHERE id = ? AND version = ? AND stock >= ?
4. affected_rows = 0 → 并发冲突 → 自动重试（最多 3 次）
5. 成功后在同一事务内写流水
6. COMMIT（原子提交）
```

### SQLite 配置

```sql
PRAGMA journal_mode=WAL;      -- 读写不互阻
PRAGMA synchronous=NORMAL;    -- WAL 模式下安全
PRAGMA busy_timeout=5000;     -- 写锁等待 5 秒而非报错
```

## 预警机制

- 每次出库/损耗后，若 `after_stock <= warning_threshold`，异步投递到 channel
- 后台 goroutine 消费 channel，写预警记录并调用 Notifier
- **防重复**：同一商品存在未处理预警时，不重复创建
- Notifier 接口可扩展：目前默认输出日志，可替换为钉钉/企业微信 webhook

## 扩展指引

| 需求          | 改动点                                    |
|-------------|----------------------------------------|
| 接入钉钉通知      | 实现 `notify.Notifier` 接口，替换 `main.go` 中注入 |
| 多仓库         | products / stock_logs 加 `warehouse_id` 字段 |
| JWT 鉴权      | 在 `main.go` 加中间件，读取 Authorization header |
| 换 PostgreSQL | 只需替换 repository 层实现，service/handler 不变  |
| 批量入库 CSV    | 新增 handler 解析 multipart，循环调用 StockService |
