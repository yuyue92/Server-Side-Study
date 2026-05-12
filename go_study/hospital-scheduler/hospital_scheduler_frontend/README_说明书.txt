Hospital Scheduler 前端联调页 - 使用说明
========================================

一、文件说明
- index.html：前端入口
- styles.css：页面样式
- app.js：接口联调逻辑
- start_frontend.bat：Windows 下快捷启动本地静态服务器

二、推荐启动方式（Windows）
1. 先启动后端服务，默认接口应可访问：
   http://localhost:8080/api/v1
2. 双击 start_frontend.bat
3. 浏览器会打开：
   http://localhost:5500

三、直接打开方式
也可以直接双击 index.html 打开。
但若浏览器或后端 CORS 对 file:// Origin 有限制，建议使用 start_frontend.bat 或自行运行：

python -m http.server 5500

四、页面覆盖的接口
- GET /health
- GET /api/v1/departments
- POST /api/v1/departments
- GET /api/v1/shift-types
- GET /api/v1/staff
- POST /api/v1/staff
- GET /api/v1/staff/:id
- GET /api/v1/slots
- POST /api/v1/slots
- POST /api/v1/assignments
- DELETE /api/v1/assignments/:id
- POST /api/v1/schedule/auto
- GET /api/v1/workload?department_id=...
- GET /api/v1/emergency/candidates/:slotId
- POST /api/v1/emergency/assign
- POST /api/v1/swaps
- GET /api/v1/swaps/pending
- POST /api/v1/swaps/:id/review

五、兼容说明
1. 换班申请：README 示例使用 slot_id；SQL 表中字段是 requester_slot_id。
   页面请求按 README 使用 slot_id，列表展示同时兼容 requester_slot_id / slot_id。
2. 应急分配 POST /emergency/assign：README 未给出详细请求体字段。
   页面保留可编辑 JSON 调试区，并给出默认示例：
   {
     "staff_id": 1,
     "slot_id": 1,
     "created_by": 1,
     "note": "紧急调度"
   }
   若你的后端真实字段不同，可直接在页面里修改 JSON 后提交。
3. 响应渲染兼容 raw array、data、items、result、rows 等常见返回包装。

六、联调建议
1. 先点击“健康检查”确认服务通。
2. 点击“刷新基础数据”加载科室、班次、员工。
3. 先创建或查询排班格，再做手动排班、自动排班。
4. 通过右下的请求日志核对每次请求体、响应体、状态码和耗时。
