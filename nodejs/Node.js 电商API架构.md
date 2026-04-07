给一个**适合学习、也能真实落地**的 Node.js 电商后台 API 核心架构方案：**先做“模块化单体 + 异步任务”**，不要一开始就拆微服务。NestJS 本身就很适合这种路线：它强调模块化，同时官方也提供微服务、版本化、OpenAPI、认证、缓存、队列等能力，后续再拆不会推翻重来。([NestJS 文档][1])

先说我推荐的基础选型：

* **运行时**：Node.js 直接用 LTS 线。按 2026-04-07 的官方发布状态，v24 是 Active LTS，v22 和 v20 是 Maintenance LTS；生产环境应优先使用 Active LTS 或 Maintenance LTS。([Node.js][2])
* **框架**：**NestJS + TypeScript**。Nest 底层可用 Express，也可切到 Fastify；如果你更看重结构清晰和中后台工程化，Nest 比“裸 Express”更适合做电商后台。([NestJS 文档][1])
* **数据库**：**PostgreSQL** 做主库，订单、库存、支付、优惠券这些核心数据都以它为准；如果你用 Prisma，官方也支持多种事务方式，适合处理订单创建、库存扣减、支付状态变更这种原子操作。([prisma.io][3])
* **缓存/队列**：**Redis + BullMQ**。Redis 官方文档明确把它定位为可用于 caching、queuing、event processing 的数据结构服务器；Nest 官方也把队列作为处理削峰、异步任务、跨进程可靠通信的重要模式，并说明 BullMQ 是当前积极开发的路线。([Redis][4])
* **接口文档与观测**：**OpenAPI/Swagger + OpenTelemetry**。Nest 官方支持自动生成 OpenAPI；OpenTelemetry 的 Node.js 指南支持 traces 和 metrics，适合后面接监控平台。([NestJS 文档][5])

我建议你的总体结构长这样：

```text
管理后台前端
   |
Nginx / API Gateway
   |
NestJS API（模块化单体）
   ├─ Auth / IAM
   ├─ Admin User / Role / Permission
   ├─ Catalog（商品/SPU/SKU/类目/品牌）
   ├─ Inventory（库存）
   ├─ Order（订单）
   ├─ Payment（支付/退款）
   ├─ Promotion（优惠券/活动）
   ├─ Logistics（发货/物流）
   ├─ Media（图片/附件）
   ├─ Notification（短信/邮件/站内信）
   ├─ Audit Log（操作审计）
   └─ Report（报表/导出）
   |
   ├─ PostgreSQL
   ├─ Redis
   ├─ BullMQ Worker
   ├─ Object Storage（MinIO / S3 / OSS）
   └─ Search（可选：OpenSearch / Elasticsearch）
```

## 一、最核心的设计原则

### 1）先做“模块化单体”，不要先做微服务

对学习阶段和早期项目来说，最容易出问题的不是代码量，而是**分布式复杂度**。所以一开始把所有核心业务放在一个 NestJS 应用里，但内部严格按领域拆模块。这样你能先把订单、库存、支付这些主链路做扎实；当某个模块访问量、团队边界、发布频率明显独立时，再拆服务。Nest 同时支持模块化和微服务能力，这种演进路径是顺的。([NestJS 文档][6])

### 2）电商里“数据库是事实源”，Redis 是加速器，不是真相

商品详情页、类目树、字典配置可以放缓存；但**库存、订单状态、支付状态**必须以 PostgreSQL 为准。PostgreSQL 官方文档明确说明了行锁和 `SELECT ... FOR UPDATE` 的并发控制行为；Redis 分布式锁可以辅助做跨进程互斥，但不应该替代数据库事务与行锁作为最终一致性的基础。([PostgreSQL][7])

### 3）把“慢操作”和“非核心实时操作”全部异步化

比如：支付超时取消、发短信/邮件、库存同步、搜索索引刷新、导出 Excel、生成报表、图片处理，这些都不要挂在用户请求链路上同步完成。Nest 官方对队列的定位就是削峰、分解阻塞任务、做可靠跨进程任务处理；BullMQ 本身也支持延迟任务和作业状态管理。([NestJS 文档][8])

---

## 二、推荐的模块边界

### 必做的 6 个核心模块

这是你第一版后台最该先做的：

* **Auth / IAM**：管理员登录、JWT、角色、权限、菜单权限、数据权限。Nest 官方认证章节直接给出 JWT 认证思路，适合前后端分离后台。([NestJS 文档][9])
* **Catalog**：商品、SPU、SKU、类目、品牌、价格、上下架。
* **Inventory**：库存增加、扣减、冻结、释放、盘点。
* **Order**：创建订单、订单状态流转、取消、售后入口。
* **Payment**：支付单、回调、退款、幂等处理。
* **Audit Log**：后台谁在什么时候改了什么，必须能追溯。

### 第二阶段再加的模块

* Promotion：优惠券、满减、限时活动
* Logistics：发货、面单、物流跟踪
* Notification：短信、邮件、站内通知
* Report：订单报表、销售统计、库存预警
* Media：商品图、富文本图片、附件上传

---

## 三、模块内部怎么分层

我建议每个模块都遵守同一套 4 层结构：

### 1）Interface 层

负责 HTTP API 暴露：

* Controller
* DTO / 参数校验
* API Versioning
* Swagger/OpenAPI 文档

Nest 官方支持 URI/Header 等版本化方式，也支持基于装饰器生成 OpenAPI 文档；对于后台 API，直接用 `/v1/...` 最简单。([NestJS 文档][10])

### 2）Application 层

负责业务用例编排：

* `CreateOrder`
* `CancelOrder`
* `AdjustStock`
* `ConfirmPayment`

这层只关心“做什么”，不直接关心 HTTP 和数据库细节。

### 3）Domain 层

负责核心业务规则：

* 订单状态机
* 库存冻结/释放规则
* 优惠券可用性判断
* 支付状态转换规则

电商项目最怕业务规则散在 Controller 和 SQL 里，所以规则要尽量收敛到这里。

### 4）Infrastructure 层

负责技术实现：

* Prisma Repository
* Redis Cache
* BullMQ Producer/Consumer
* 文件存储
* 第三方支付 SDK
* 短信邮件网关

这样做的好处是：**以后就算你从 Prisma 换 ORM，或者把单体某个模块拆成服务，也不会把业务规则拆碎。**

---

## 四、最关键的三条业务链路

### 1）下单链路

建议流程是：

1. 校验商品、价格、库存、优惠券
2. 开启数据库事务
3. 创建订单主表/明细表
4. 冻结或扣减库存
5. 写入支付单
6. 提交事务
7. 投递异步任务：超时取消、通知、索引刷新

Prisma 官方支持事务；PostgreSQL 官方文档也说明了行级锁的并发语义，所以库存相关操作应放在事务里处理，而不是单靠缓存判断。([prisma.io][3])

### 2）库存链路

库存建议分成至少三种值：

* `available_stock`
* `locked_stock`
* `sold_stock`（可选）

这样你可以支持“下单锁库存、超时释放、支付成功转已售”。
跨进程抢同一 SKU 时，可以辅助加 Redis 锁，但**最终扣减仍走数据库事务/行锁**。PostgreSQL 的 `FOR UPDATE` 会阻塞其他事务对同一行的冲突写操作；Redis 锁则更适合做热点资源互斥。([PostgreSQL][7])

### 3）支付链路

支付回调一定要单独做成：

* 可重复调用
* 幂等
* 有签名校验
* 可审计

建议以“支付流水号 / 第三方交易号”做唯一约束，避免重复回调造成重复改单。支付成功后只做核心状态更新，短信、通知、发票、积分等都走异步队列。

---

## 五、缓存、队列、搜索分别怎么用

### 缓存

适合缓存：

* 商品详情
* 类目树
* 品牌列表
* 配置字典
* 后台权限菜单

不适合缓存：

* 下单
* 支付
* 库存扣减
* 优惠券领取/核销

Nest 官方缓存文档也明确提醒：**执行业务操作的动作不应直接缓存**。([NestJS 文档][11])

### 队列

BullMQ 适合放这些任务：

* 订单超时自动取消（延迟任务）
* 发短信/邮件
* 导出报表
* 生成账单
* 搜索索引刷新
* 清理历史日志

Nest 官方说明 BullMQ/Bull 都是 Redis-backed，能做分布式队列；其中 BullMQ 是当前积极开发的方向。([NestJS 文档][8])

### 搜索

先别急着上 Elasticsearch / OpenSearch。
如果你第一版只是后台商品管理、订单查询，PostgreSQL 索引通常够用。只有当你开始做复杂商品检索、拼音/分词、多条件组合搜索时，再引入搜索引擎。

---

## 六、安全与后台治理，这些必须从一开始就有

* **JWT + RBAC**：管理员登录后发 token，再用角色/权限控制菜单和接口。Nest 官方认证文档直接覆盖了 JWT 认证流程。([NestJS 文档][9])
* **API Versioning**：所有正式接口从一开始就走 `/v1`。Nest 官方原生支持版本化。([NestJS 文档][10])
* **OpenAPI 文档**：前后端联调、测试、后续维护都会轻松很多。([NestJS 文档][5])
* **审计日志**：谁改了价格、库存、订单状态，必须能追踪。
* **幂等设计**：支付回调、库存调整、批量导入都要能防重复提交。
* **请求链路追踪**：至少带上 requestId / traceId。OpenTelemetry 的 Node.js 指南支持 traces 和 metrics，适合做这层基础能力。([OpenTelemetry][12])

---

## 七、什么时候该拆微服务

等出现下面任一情况，再拆都不晚：

* 订单、库存、支付已经明显成为独立团队边界
* 搜索/报表/通知任务量很大，单体 Worker 顶不住
* 发布节奏冲突明显，一个模块频繁发版会拖累全站
* 某个模块需要独立扩容，比如搜索或库存

拆分顺序一般是：
**通知/报表 Worker → 搜索服务 → 库存服务 → 订单服务**
不要先拆 Auth，也不要先拆商品。

---

