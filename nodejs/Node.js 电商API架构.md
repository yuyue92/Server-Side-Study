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


好，我直接给你一版 **可落地的 v1 设计**。
目标是：你拿着这份，就能继续往下做详细设计、数据库建表和接口文档。

---

# 一、模块清单

我建议先拆成 **12 个模块**，其中前 7 个是 v1 核心，后面的是增强模块。

## 1. 系统与权限模块

负责后台管理员体系。

包含：

* 管理员账号
* 角色
* 权限点
* 菜单
* 登录认证
* 操作日志
* 数据字典
* 系统配置

子模块建议：

* `auth`
* `admin-user`
* `role`
* `permission`
* `menu`
* `audit-log`
* `config`

---

## 2. 商品中心模块

负责商品基础信息管理。

包含：

* 类目
* 品牌
* SPU
* SKU
* 商品属性
* 商品图片
* 上下架
* 价格管理

子模块建议：

* `category`
* `brand`
* `product-spu`
* `product-sku`
* `product-attribute`
* `product-media`

---

## 3. 库存模块

负责库存数量流转。

包含：

* 实时库存
* 锁定库存
* 可售库存
* 库存流水
* 入库/出库/调整
* 库存预警

子模块建议：

* `inventory`
* `inventory-record`
* `inventory-adjust`
* `inventory-alert`

---

## 4. 订单模块

负责订单主流程。

包含：

* 订单创建
* 订单明细
* 订单状态流转
* 取消订单
* 关闭订单
* 发货
* 收货
* 售后入口

子模块建议：

* `order`
* `order-item`
* `order-operate-log`
* `order-after-sale`（可先留空）

---

## 5. 支付模块

负责支付和退款。

包含：

* 支付单
* 支付回调
* 支付状态同步
* 退款单
* 退款流水

子模块建议：

* `payment`
* `payment-transaction`
* `refund`

---

## 6. 营销模块

v1 可先做简单版本。

包含：

* 优惠券模板
* 用户优惠券
* 满减规则
* 活动规则

子模块建议：

* `coupon-template`
* `coupon`
* `promotion-rule`

---

## 7. 物流模块

负责发货和物流跟踪。

包含：

* 发货单
* 快递公司
* 运单号
* 发货状态
* 物流轨迹同步

子模块建议：

* `shipment`
* `shipment-company`
* `shipment-track`

---

## 8. 会员模块

如果后台还要管理用户。

包含：

* 用户基本信息
* 收货地址
* 标签
* 黑名单
* 用户等级

子模块建议：

* `member`
* `member-address`
* `member-tag`

---

## 9. 通知模块

负责异步通知。

包含：

* 短信
* 邮件
* 站内信
* 消息模板
* 发送记录

---

## 10. 内容与素材模块

负责商品图、详情图、富文本图片、附件。

包含：

* 文件上传
* 媒体资源
* 图片分组
* 文件引用关系

---

## 11. 报表模块

负责后台统计。

包含：

* 订单统计
* 销售统计
* 商品销量排行
* 库存报表
* 导出任务

---

## 12. 基础设施模块

是技术层支撑，不直接面向业务。

包含：

* 缓存
* 队列
* 定时任务
* 统一异常
* 请求日志
* 幂等处理
* 文件存储适配器
* 第三方支付适配器

---

# 二、领域拆分建议

为了避免后面写乱，建议你一开始就分成这几类边界：

## 核心交易域

* 商品
* 库存
* 订单
* 支付
* 物流

## 后台治理域

* 管理员
* 角色权限
* 审计日志
* 系统配置

## 增值业务域

* 优惠券
* 营销活动
* 通知
* 报表
* 内容素材

---

# 三、表设计草图

下面给你一版 **核心表草图**。
不是最终 SQL，而是“应该有哪些表、关键字段是什么、彼此怎么关联”。

---

## A. 权限与后台管理

### 1. `admin_user`

后台管理员表

关键字段：

* `id`
* `username`
* `password_hash`
* `nickname`
* `phone`
* `email`
* `status`
* `last_login_at`
* `created_at`
* `updated_at`

---

### 2. `role`

角色表

关键字段：

* `id`
* `name`
* `code`
* `status`
* `remark`
* `created_at`

---

### 3. `permission`

权限点表

关键字段：

* `id`
* `name`
* `code`
* `type`（menu/button/api）
* `path`
* `method`
* `parent_id`
* `sort`
* `status`

---

### 4. `admin_user_role`

管理员-角色关系表

关键字段：

* `id`
* `admin_user_id`
* `role_id`

---

### 5. `role_permission`

角色-权限关系表

关键字段：

* `id`
* `role_id`
* `permission_id`

---

### 6. `audit_log`

操作日志表

关键字段：

* `id`
* `admin_user_id`
* `module`
* `action`
* `target_type`
* `target_id`
* `request_method`
* `request_path`
* `request_body`
* `response_body`
* `ip`
* `user_agent`
* `created_at`

---

## B. 商品中心

### 7. `category`

商品类目表

关键字段：

* `id`
* `parent_id`
* `name`
* `level`
* `sort`
* `status`
* `icon`
* `created_at`

---

### 8. `brand`

品牌表

关键字段：

* `id`
* `name`
* `logo`
* `description`
* `status`
* `created_at`

---

### 9. `product_spu`

SPU 表，代表商品抽象

关键字段：

* `id`
* `title`
* `sub_title`
* `category_id`
* `brand_id`
* `main_image`
* `status`（draft/on_sale/off_sale）
* `audit_status`
* `description`
* `created_at`
* `updated_at`

---

### 10. `product_sku`

SKU 表，代表具体售卖单元

关键字段：

* `id`
* `spu_id`
* `sku_code`
* `name`
* `spec_json`
* `sale_price`
* `market_price`
* `cost_price`
* `weight`
* `volume`
* `status`
* `created_at`
* `updated_at`

说明：

* `spec_json` 用来存规格组合，比如颜色/尺寸
* 查询时常用 `spu_id + status`

---

### 11. `product_image`

商品图片表

关键字段：

* `id`
* `spu_id`
* `sku_id`
* `url`
* `type`（main/detail/gallery）
* `sort`

---

### 12. `product_attribute`

商品属性定义表

关键字段：

* `id`
* `category_id`
* `name`
* `input_type`
* `value_type`
* `required`
* `searchable`
* `sort`

---

### 13. `product_attribute_value`

商品属性值表

关键字段：

* `id`
* `spu_id`
* `sku_id`
* `attribute_id`
* `value_text`

---

## C. 库存模块

### 14. `inventory`

库存主表

关键字段：

* `id`
* `sku_id`
* `total_stock`
* `available_stock`
* `locked_stock`
* `sold_stock`
* `warning_stock`
* `version`
* `updated_at`

说明：

* `version` 可用于乐观锁
* 高频查询主键建议放在 `sku_id`

---

### 15. `inventory_record`

库存流水表

关键字段：

* `id`
* `sku_id`
* `biz_type`（purchase/order_lock/order_release/order_deduct/refund_return/manual_adjust）
* `biz_id`
* `change_qty`
* `before_available_stock`
* `after_available_stock`
* `before_locked_stock`
* `after_locked_stock`
* `operator_type`
* `operator_id`
* `remark`
* `created_at`

---

## D. 会员模块

### 16. `member`

用户表

关键字段：

* `id`
* `nickname`
* `phone`
* `email`
* `status`
* `level`
* `register_at`
* `created_at`

---

### 17. `member_address`

收货地址表

关键字段：

* `id`
* `member_id`
* `receiver_name`
* `receiver_phone`
* `province`
* `city`
* `district`
* `detail_address`
* `postal_code`
* `is_default`

---

## E. 订单模块

### 18. `order`

订单主表

关键字段：

* `id`
* `order_no`
* `member_id`
* `order_status`
* `payment_status`
* `shipment_status`
* `source_type`
* `total_amount`
* `discount_amount`
* `freight_amount`
* `payable_amount`
* `paid_amount`
* `coupon_amount`
* `remark`
* `receiver_name`
* `receiver_phone`
* `receiver_province`
* `receiver_city`
* `receiver_district`
* `receiver_address`
* `submitted_at`
* `paid_at`
* `cancelled_at`
* `shipped_at`
* `finished_at`
* `created_at`
* `updated_at`

建议订单状态：

* `pending_payment`
* `paid`
* `to_ship`
* `shipped`
* `completed`
* `cancelled`
* `closed`
* `refund_processing`
* `refunded`

---

### 19. `order_item`

订单明细表

关键字段：

* `id`
* `order_id`
* `order_no`
* `spu_id`
* `sku_id`
* `sku_name`
* `sku_spec_json`
* `quantity`
* `sale_price`
* `origin_amount`
* `discount_amount`
* `real_amount`
* `created_at`

---

### 20. `order_operate_log`

订单操作日志表

关键字段：

* `id`
* `order_id`
* `order_no`
* `operator_type`（system/admin/member）
* `operator_id`
* `action`
* `before_status`
* `after_status`
* `remark`
* `created_at`

---

## F. 支付模块

### 21. `payment_order`

支付单表

关键字段：

* `id`
* `payment_no`
* `order_id`
* `order_no`
* `member_id`
* `payment_channel`
* `amount`
* `status`
* `third_party_trade_no`
* `notify_data`
* `paid_at`
* `expired_at`
* `created_at`

状态建议：

* `pending`
* `success`
* `failed`
* `closed`

---

### 22. `payment_transaction`

支付流水表

关键字段：

* `id`
* `payment_order_id`
* `transaction_type`（pay/refund）
* `transaction_no`
* `channel`
* `amount`
* `status`
* `third_party_transaction_no`
* `request_data`
* `response_data`
* `created_at`

---

### 23. `refund_order`

退款单表

关键字段：

* `id`
* `refund_no`
* `order_id`
* `order_item_id`
* `payment_order_id`
* `refund_amount`
* `reason`
* `status`
* `applied_at`
* `success_at`
* `created_at`

---

## G. 优惠券模块

### 24. `coupon_template`

优惠券模板表

关键字段：

* `id`
* `name`
* `type`（cash/discount）
* `threshold_amount`
* `discount_amount`
* `discount_rate`
* `start_time`
* `end_time`
* `total_count`
* `issued_count`
* `used_count`
* `status`

---

### 25. `coupon`

用户优惠券表

关键字段：

* `id`
* `coupon_template_id`
* `member_id`
* `status`
* `obtain_time`
* `used_time`
* `expire_time`
* `order_id`

---

## H. 物流模块

### 26. `shipment`

发货单表

关键字段：

* `id`
* `shipment_no`
* `order_id`
* `order_no`
* `company_code`
* `company_name`
* `tracking_no`
* `status`
* `shipped_at`
* `delivered_at`
* `created_at`

---

### 27. `shipment_track`

物流轨迹表

关键字段：

* `id`
* `shipment_id`
* `content`
* `track_time`
* `raw_data`

---

## I. 素材与文件

### 28. `media_file`

文件表

关键字段：

* `id`
* `biz_type`
* `file_name`
* `file_url`
* `file_size`
* `mime_type`
* `storage_type`
* `uploaded_by`
* `created_at`

---

## J. 系统配置

### 29. `system_config`

系统配置表

关键字段：

* `id`
* `config_group`
* `config_key`
* `config_value`
* `remark`
* `updated_at`

---

# 四、表之间的核心关系

最重要的几条关系你要先记牢：

* `product_spu 1 -> n product_sku`
* `product_sku 1 -> 1 inventory`
* `member 1 -> n order`
* `order 1 -> n order_item`
* `order 1 -> 1 payment_order`（v1 可按单支付）
* `payment_order 1 -> n payment_transaction`
* `order 1 -> n order_operate_log`
* `order 1 -> n shipment`（支持拆单时可扩展）
* `coupon_template 1 -> n coupon`
* `admin_user n -> n role`

---

# 五、建议的索引草图

这里先不给 SQL，只说你一定要建的索引。

## 唯一索引

* `admin_user.username`
* `role.code`
* `permission.code`
* `product_sku.sku_code`
* `order.order_no`
* `payment_order.payment_no`
* `payment_transaction.transaction_no`
* `refund_order.refund_no`
* `shipment.shipment_no`

## 普通索引

* `product_spu.category_id`
* `product_spu.brand_id`
* `product_spu.status`
* `product_sku.spu_id`
* `inventory.sku_id`
* `order.member_id`
* `order.order_status`
* `order.payment_status`
* `order.created_at`
* `order_item.order_id`
* `payment_order.order_id`
* `payment_order.status`
* `coupon.member_id`
* `coupon.status`
* `shipment.order_id`

## 组合索引

* `order(member_id, order_status)`
* `order(order_status, created_at)`
* `product_sku(spu_id, status)`
* `coupon(member_id, status, expire_time)`

---

# 六、接口目录草案

下面按后台 API 思路给你一版。

---

## 1. 认证与权限

### Auth

* `POST /api/v1/auth/login`
* `POST /api/v1/auth/logout`
* `GET /api/v1/auth/profile`
* `POST /api/v1/auth/refresh-token`

### Admin User

* `GET /api/v1/admin-users`
* `POST /api/v1/admin-users`
* `GET /api/v1/admin-users/:id`
* `PUT /api/v1/admin-users/:id`
* `PATCH /api/v1/admin-users/:id/status`
* `PATCH /api/v1/admin-users/:id/password`
* `DELETE /api/v1/admin-users/:id`

### Role

* `GET /api/v1/roles`
* `POST /api/v1/roles`
* `GET /api/v1/roles/:id`
* `PUT /api/v1/roles/:id`
* `PATCH /api/v1/roles/:id/status`
* `DELETE /api/v1/roles/:id`
* `PUT /api/v1/roles/:id/permissions`

### Permission / Menu

* `GET /api/v1/permissions/tree`
* `GET /api/v1/menus/tree`

### Audit Log

* `GET /api/v1/audit-logs`
* `GET /api/v1/audit-logs/:id`

---

## 2. 商品中心

### Category

* `GET /api/v1/categories/tree`
* `POST /api/v1/categories`
* `PUT /api/v1/categories/:id`
* `DELETE /api/v1/categories/:id`

### Brand

* `GET /api/v1/brands`
* `POST /api/v1/brands`
* `PUT /api/v1/brands/:id`
* `DELETE /api/v1/brands/:id`

### SPU

* `GET /api/v1/products/spu`
* `POST /api/v1/products/spu`
* `GET /api/v1/products/spu/:id`
* `PUT /api/v1/products/spu/:id`
* `PATCH /api/v1/products/spu/:id/on-sale`
* `PATCH /api/v1/products/spu/:id/off-sale`
* `DELETE /api/v1/products/spu/:id`

### SKU

* `POST /api/v1/products/spu/:id/skus`
* `PUT /api/v1/products/skus/:skuId`
* `GET /api/v1/products/skus/:skuId`
* `PATCH /api/v1/products/skus/:skuId/status`

### 商品属性

* `GET /api/v1/product-attributes`
* `POST /api/v1/product-attributes`
* `PUT /api/v1/product-attributes/:id`
* `DELETE /api/v1/product-attributes/:id`

---

## 3. 库存

* `GET /api/v1/inventories`
* `GET /api/v1/inventories/:skuId`
* `POST /api/v1/inventories/:skuId/inbound`
* `POST /api/v1/inventories/:skuId/outbound`
* `POST /api/v1/inventories/:skuId/adjust`
* `GET /api/v1/inventory-records`
* `GET /api/v1/inventory-alerts`

说明：

* 后台管理接口可有“手工调整库存”
* 系统内部还会有服务内调用的“锁库存、释放库存、扣减库存”应用服务，不一定暴露给后台 UI

---

## 4. 会员

* `GET /api/v1/members`
* `GET /api/v1/members/:id`
* `GET /api/v1/members/:id/addresses`
* `PATCH /api/v1/members/:id/status`
* `PATCH /api/v1/members/:id/tags`

---

## 5. 订单

### 后台订单管理

* `GET /api/v1/orders`
* `GET /api/v1/orders/:id`
* `GET /api/v1/orders/:id/items`
* `PATCH /api/v1/orders/:id/cancel`
* `PATCH /api/v1/orders/:id/close`
* `PATCH /api/v1/orders/:id/remark`
* `GET /api/v1/orders/:id/logs`

### 发货相关

* `POST /api/v1/orders/:id/ship`
* `GET /api/v1/orders/:id/shipments`

### 售后相关

* `GET /api/v1/after-sales`
* `GET /api/v1/after-sales/:id`
* `PATCH /api/v1/after-sales/:id/approve`
* `PATCH /api/v1/after-sales/:id/reject`

---

## 6. 支付

* `GET /api/v1/payments`
* `GET /api/v1/payments/:id`
* `GET /api/v1/payments/:id/transactions`
* `POST /api/v1/payments/:id/requery`
* `POST /api/v1/refunds`
* `GET /api/v1/refunds`
* `GET /api/v1/refunds/:id`

### 支付回调接口

这类一般给第三方调用，不给后台页面直接用：

* `POST /api/v1/payment-callbacks/alipay`
* `POST /api/v1/payment-callbacks/wechat`
* `POST /api/v1/refund-callbacks/alipay`
* `POST /api/v1/refund-callbacks/wechat`

---

## 7. 优惠券与营销

### 优惠券模板

* `GET /api/v1/coupon-templates`
* `POST /api/v1/coupon-templates`
* `PUT /api/v1/coupon-templates/:id`
* `PATCH /api/v1/coupon-templates/:id/status`
* `GET /api/v1/coupon-templates/:id`

### 用户优惠券

* `GET /api/v1/coupons`
* `GET /api/v1/coupons/:id`
* `POST /api/v1/coupons/issue`

---

## 8. 物流

* `GET /api/v1/shipments`
* `GET /api/v1/shipments/:id`
* `GET /api/v1/shipments/:id/tracks`
* `POST /api/v1/shipments/:id/refresh-track`

---

## 9. 文件与素材

* `POST /api/v1/files/upload`
* `GET /api/v1/files`
* `DELETE /api/v1/files/:id`

---

## 10. 系统配置

* `GET /api/v1/system-configs`
* `PUT /api/v1/system-configs/:id`

---

## 11. 报表

* `GET /api/v1/reports/orders/summary`
* `GET /api/v1/reports/orders/trend`
* `GET /api/v1/reports/products/top-sales`
* `GET /api/v1/reports/inventories/warnings`
* `POST /api/v1/reports/export`

---

# 七、内部服务接口建议

这部分不是给前端调的，而是你在系统内部最好统一的“应用服务”。

比如订单创建时会依赖这些内部能力：

* `InventoryService.lockStock(orderNo, items)`
* `InventoryService.releaseStock(orderNo)`
* `InventoryService.deductLockedStock(orderNo)`
* `PaymentService.createPayment(orderNo)`
* `OrderService.cancelTimeoutOrder(orderNo)`
* `ShipmentService.createShipment(orderNo)`
* `CouponService.freezeCoupon(couponId)`
* `CouponService.useCoupon(couponId, orderId)`

这样业务流程会更清晰，不会把逻辑堆在 controller 里。

---

# 八、订单状态机建议

这个很重要，建议你一开始就明确。

## 订单主状态

* `pending_payment`
* `paid`
* `to_ship`
* `shipped`
* `completed`
* `cancelled`
* `closed`

## 支付状态

* `unpaid`
* `paid`
* `refund_processing`
* `refunded`
* `payment_failed`

## 发货状态

* `not_shipped`
* `partially_shipped`
* `shipped`
* `received`

---

# 九、你可以先做的 v1 范围

为了避免项目过大，建议第一阶段只做这些：

## v1 必做

* 管理员登录/权限
* 类目/品牌/SPU/SKU
* 库存管理
* 订单查询与发货
* 支付单查询
* 操作日志
* 文件上传
* 报表基础统计

## v1.5 再做

* 优惠券
* 退款
* 售后
* 物流轨迹
* 导出
* 通知

---

# 十、推荐的项目目录结构

你后面写 NestJS 时，可以按这个方式组织：

```text
src/
  modules/
    auth/
    admin-user/
    role/
    permission/
    audit-log/
    category/
    brand/
    product/
    inventory/
    member/
    order/
    payment/
    coupon/
    shipment/
    media/
    report/
    system-config/
  common/
    decorators/
    filters/
    guards/
    interceptors/
    pipes/
    utils/
    constants/
  infrastructure/
    database/
    cache/
    queue/
    storage/
    payment/
  main.ts
```

---


