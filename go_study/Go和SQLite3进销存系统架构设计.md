
# 进销存管理系统 API 架构设计

## 一、系统概述

进销存（采购 · 销售 · 库存）是中小企业核心业务流，系统需覆盖：**商品管理 → 采购入库 → 库存调拨 → 销售出库 → 财务对账** 完整闭环。

---

## 二、技术选型

| 层次 | 技术 | 说明 |
|------|------|------|
| 语言 | Go 1.22+ | 高并发、编译型、部署简单 |
| Web 框架 | Gin | 轻量、生态成熟 |
| ORM | GORM | 支持 SQLite3，迁移方便 |
| 数据库 | SQLite3 (modernc/go-sqlite3) | 单文件、零依赖部署 |
| 认证 | JWT (golang-jwt) | 无状态 Token |
| 日志 | Zap | 结构化高性能日志 |
| 配置 | Viper | 多环境配置管理 |
| 校验 | go-playground/validator | 入参校验 |
| 文档 | Swagger (swaggo) | 自动生成 API 文档 |

---

## 三、项目目录结构

```
ims-api/
├── cmd/
│   └── server/          # 程序入口 main.go
├── config/              # 配置文件 (yaml)
├── internal/
│   ├── handler/         # HTTP 处理器（Controller 层）
│   ├── service/         # 业务逻辑层
│   ├── repository/      # 数据访问层（DAL）
│   ├── model/           # GORM 数据模型
│   ├── dto/             # 请求/响应 DTO
│   ├── middleware/       # JWT、日志、限流中间件
│   └── pkg/             # 工具包（响应封装、错误码等）
├── migrations/          # 数据库迁移脚本
├── docs/                # Swagger 文档
└── data/                # SQLite3 数据库文件
```

---

## 四、数据库模型设计

### 核心实体关系

```
用户(users)
    │
    ├── 供应商(suppliers)──────────────┐
    ├── 客户(customers)                │
    └── 商品(products)                 │
            │                          │
            ├── 分类(categories)        │
            ├── 库存(inventory)         │
            │       └── 库存流水(inventory_logs)
            │
            ├── 采购单(purchase_orders)─┘
            │       └── 采购明细(purchase_items)
            │
            └── 销售单(sale_orders)
                    └── 销售明细(sale_items)
```

### 主要数据表

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `users` | 用户/员工 | role, status |
| `categories` | 商品分类 | parent_id（支持多级） |
| `products` | 商品主档 | sku, cost_price, sale_price, unit |
| `suppliers` | 供应商 | contact, payment_terms |
| `customers` | 客户 | credit_limit |
| `inventory` | 库存快照 | product_id, quantity, warehouse |
| `inventory_logs` | 库存流水 | type(in/out/adjust), ref_id |
| `purchase_orders` | 采购单主表 | status(draft/confirmed/received) |
| `purchase_items` | 采购单明细 | qty, unit_price, received_qty |
| `sale_orders` | 销售单主表 | status(draft/confirmed/shipped/done) |
| `sale_items` | 销售单明细 | qty, unit_price, discount |

---

## 五、API 路由设计

```
/api/v1/
├── auth/
│   ├── POST   /login          # 登录获取 Token
│   └── POST   /refresh        # 刷新 Token
│
├── products/                  # 商品管理
│   ├── GET    /               # 列表（分页+搜索）
│   ├── POST   /               # 新建
│   ├── GET    /:id            # 详情
│   ├── PUT    /:id            # 更新
│   └── DELETE /:id            # 删除
│
├── inventory/                 # 库存管理
│   ├── GET    /               # 库存列表
│   ├── POST   /adjust         # 手动调整库存
│   ├── GET    /logs           # 库存流水查询
│   └── GET    /alert          # 低库存预警
│
├── purchases/                 # 采购管理
│   ├── GET    /               # 采购单列表
│   ├── POST   /               # 创建采购单
│   ├── GET    /:id            # 采购单详情
│   ├── PUT    /:id/confirm    # 确认采购单
│   └── PUT    /:id/receive    # 入库（触发库存增加）
│
├── sales/                     # 销售管理
│   ├── GET    /               # 销售单列表
│   ├── POST   /               # 创建销售单（校验库存）
│   ├── GET    /:id            # 销售单详情
│   ├── PUT    /:id/confirm    # 确认出库（触发库存扣减）
│   └── PUT    /:id/cancel     # 取消（回滚库存）
│
├── suppliers/                 # 供应商管理
├── customers/                 # 客户管理
│
└── reports/                   # 报表
    ├── GET    /sales-summary  # 销售汇总
    ├── GET    /stock-value    # 库存估值
    └── GET    /purchase-cost  # 采购成本分析
```

---

## 六、核心业务流程

### 采购入库流程
```
创建草稿单 → 确认采购 → 实物到货确认 → 自动写入 inventory_logs(type=in) → 更新 inventory.quantity
```

### 销售出库流程
```
创建销售单 → 实时校验库存充足 → 确认出库 → 自动写入 inventory_logs(type=out) → 扣减 inventory.quantity
```

> **关键设计**：库存变动全部通过 **inventory_logs 流水** 驱动，inventory 表为快照聚合值，两者通过数据库事务保持强一致。

---

## 七、分层架构与职责

```
Handler（路由/入参校验/响应格式化）
    ↓
Service（业务规则/事务编排/库存校验）
    ↓
Repository（SQL查询/GORM操作/单表CRUD）
    ↓
SQLite3（WAL模式开启，支持并发读）
```

---

## 八、中间件设计

| 中间件 | 功能 |
|--------|------|
| JWT Auth | Token 解析、角色鉴权（admin/operator/viewer） |
| RequestID | 每个请求注入唯一 ID，全链路追踪 |
| Logger | 请求日志（耗时、状态码、body） |
| Recovery | panic 恢复，避免服务崩溃 |
| RateLimiter | 基于 IP 的简单限流（令牌桶） |

---

## 九、SQLite3 生产优化策略

- 开启 **WAL 模式**（Write-Ahead Logging），提升读并发
- 设置 `PRAGMA synchronous = NORMAL` 平衡性能与安全
- 设置 `PRAGMA foreign_keys = ON` 保证引用完整性
- 库存变动操作使用 **数据库事务（BEGIN/COMMIT）** 保证原子性
- 定期 `VACUUM` 防止文件膨胀
- 单 SQLite 文件适用于 **日并发 < 500 写** 的中小企业场景

---

## 十、后续扩展点

- **多仓库支持**：inventory 表增加 warehouse_id
- **批次/序列号管理**：产品增加 batch tracking
- **换库至 PostgreSQL**：GORM 只需切换 driver，业务层零改动
- **导入导出**：Excel 批量导入商品/采购单（excelize 库）

---

