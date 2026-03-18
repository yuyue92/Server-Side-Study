下面给一版更适合“真正看懂并开始写 SQL”的整理。

## 一、ER 图式文字解读

你可以把这套库理解成一个以 **employee 员工** 为中心、向外连接多个“历史关系表”的模型。

### 1. 核心实体层

#### `employee`

员工主表，保存“这个人是谁”。

主要字段：

* `emp_no`：员工编号，主键
* `birth_date`：出生日期
* `first_name` / `last_name`：姓名
* `gender`：性别
* `hire_date`：入职日期

这是所有业务关系的中心点。`dept_emp`、`dept_manager`、`title`、`salary` 都通过 `emp_no` 指向它。

#### `department`

部门表，保存“公司有哪些部门”。

主要字段：

* `dept_no`：部门编号，主键
* `dept_name`：部门名称，唯一

它是组织结构维表。

---

### 2. 关系 / 历史层

#### `dept_emp`

员工所属部门历史表，描述：

> 某员工在某个时间段属于哪个部门

字段：

* `emp_no`
* `dept_no`
* `from_date`
* `to_date`

它同时外键连接 `employee` 和 `department`。

#### `dept_manager`

部门经理任职历史表，描述：

> 某员工在某段时间担任某部门经理

字段结构和 `dept_emp` 类似，也是连接员工和部门，但表示的是“管理角色”。

#### `title`

员工岗位 / 头衔历史表，描述：

> 某员工在某段时间的岗位名称是什么

如 `Engineer`、`Senior Engineer`、`Staff`、`Technique Leader`。它只外键连到 `employee`。

#### `salary`

员工薪资历史表，描述：

> 某员工在某段时间拿多少工资

字段：

* `emp_no`
* `amount`
* `from_date`
* `to_date`

它也是一张标准的时态历史表。

---

### 3. 安全与辅助层

#### `audit`

审计日志表，用来记录数据库中的敏感 DML 操作，当前重点记录的是 `salary` 的 `UPDATE` / `DELETE`。同时启用了 RLS。

#### `dept_emp_latest_date` 视图

从 `dept_emp` 中取出每个员工最新的一条部门日期。

#### `current_dept_emp` 视图

在 `dept_emp_latest_date` 基础上拿到员工当前部门。它相当于“员工当前部门快照表”。

---

## 二、表关系图（文字版）

你可以把 ER 关系记成下面这样：

```text
employee
  ├──< dept_emp >── department
  ├──< dept_manager >── department
  ├──< title
  └──< salary

salary --(trigger)--> audit
```

如果换成更细一点的“基数关系”表达：

```text
employee (1) ----- (N) dept_emp (N) ----- (1) department
employee (1) ----- (N) dept_manager (N) ----- (1) department
employee (1) ----- (N) title
employee (1) ----- (N) salary
salary   (写操作) -----> audit
```

含义是：

* 一个员工可以有多条部门历史
* 一个部门可以有很多员工历史记录
* 一个员工可以有多条经理任期记录
* 一个员工可以有多条岗位历史
* 一个员工可以有多条薪资历史

这套库的关键不是“当前状态”，而是“随时间变化的历史状态”。这一点从 `dept_emp`、`dept_manager`、`title`、`salary` 都带 `from_date / to_date` 可以明显看出来。

---

## 三、ER 结构的真正业务含义

### 1. 为什么不把部门、岗位、工资直接放到 `employee` 里？

因为这些信息会变化。

如果直接写在 `employee` 表里，你只能知道“现在是什么”，不能知道：

* 他以前在哪个部门
* 什么时候晋升
* 工资涨了几次
* 什么时候做过经理

而这套库是把“变化”单独存成历史表，所以能做时序分析。

### 2. 为什么大量使用 `9999-01-01`？

这是“当前仍有效”的哨兵值。

比如：

* `dept_emp.to_date = '9999-01-01'` 表示当前仍在该部门
* `title.to_date = '9999-01-01'` 表示当前仍是该头衔
* `salary.to_date = '9999-01-01'` 表示当前薪资记录仍生效

在样例数据里这一点非常明显。

---

## 四、最常见 SQL 查询示例

下面我按“入门最有价值”的顺序给你。

---

### 1）查看所有员工基础信息

```sql
SELECT *
FROM employee
ORDER BY emp_no
LIMIT 20;
```

用途：先熟悉员工主表。

---

### 2）查看所有部门

```sql
SELECT *
FROM department
ORDER BY dept_no;
```

这张表很小，通常是 join 的维表。部门样例包括 `Marketing`、`Finance`、`Development`、`Sales` 等。

---

### 3）查某员工当前所在部门

推荐直接用视图：

```sql
SELECT
    e.emp_no,
    e.first_name,
    e.last_name,
    d.dept_no,
    d.dept_name
FROM employee e
JOIN current_dept_emp c
    ON e.emp_no = c.emp_no
JOIN department d
    ON c.dept_no = d.dept_no
WHERE e.emp_no = 10010;
```

如果你查 10010，会看到她曾经在 `d004`，后来转到 `d006`；当前部门应该是后者。样例变更在 `dept_emp` 数据中能看到。

---

### 4）查某员工的部门变动历史

```sql
SELECT
    de.emp_no,
    d.dept_name,
    de.from_date,
    de.to_date
FROM dept_emp de
JOIN department d
    ON de.dept_no = d.dept_no
WHERE de.emp_no = 10010
ORDER BY de.from_date;
```

这个查询最能体现“时态表”的价值。

---

### 5）查当前每个部门有多少员工

```sql
SELECT
    d.dept_no,
    d.dept_name,
    COUNT(*) AS employee_count
FROM current_dept_emp c
JOIN department d
    ON c.dept_no = d.dept_no
GROUP BY d.dept_no, d.dept_name
ORDER BY employee_count DESC;
```

这是最经典的部门人数统计。

---

### 6）查当前每个部门的经理是谁

```sql
SELECT
    dm.dept_no,
    d.dept_name,
    e.emp_no,
    e.first_name,
    e.last_name,
    dm.from_date,
    dm.to_date
FROM dept_manager dm
JOIN department d
    ON dm.dept_no = d.dept_no
JOIN employee e
    ON dm.emp_no = e.emp_no
WHERE dm.to_date = DATE '9999-01-01'
ORDER BY dm.dept_no;
```

这个查的是“当前经理”。因为 `dept_manager` 也是历史表，所以必须筛当前有效记录。

---

### 7）查某员工的岗位发展历史

```sql
SELECT
    emp_no,
    title,
    from_date,
    to_date
FROM title
WHERE emp_no = 10004
ORDER BY from_date;
```

10004 就是很典型的例子：先 `Engineer`，后 `Senior Engineer`。

---

### 8）查当前各岗位人数

```sql
SELECT
    title,
    COUNT(*) AS cnt
FROM title
WHERE to_date = DATE '9999-01-01'
GROUP BY title
ORDER BY cnt DESC;
```

这可以帮助你理解公司当前岗位结构。

---

### 9）查某员工薪资历史

```sql
SELECT
    emp_no,
    amount,
    from_date,
    to_date
FROM salary
WHERE emp_no = 10001
ORDER BY from_date;
```

10001 的薪资记录能看到逐年增长过程，从 60117 到当前 88958。

---

### 10）查当前薪资

```sql
SELECT
    e.emp_no,
    e.first_name,
    e.last_name,
    s.amount AS current_salary
FROM employee e
JOIN salary s
    ON e.emp_no = s.emp_no
WHERE s.to_date = DATE '9999-01-01'
ORDER BY s.amount DESC
LIMIT 20;
```

这是“当前高薪员工榜”。

---

### 11）查各部门当前平均薪资

这个是实战里最常用的 join 之一：

```sql
SELECT
    d.dept_name,
    ROUND(AVG(s.amount), 2) AS avg_salary
FROM current_dept_emp c
JOIN department d
    ON c.dept_no = d.dept_no
JOIN salary s
    ON c.emp_no = s.emp_no
WHERE s.to_date = DATE '9999-01-01'
GROUP BY d.dept_name
ORDER BY avg_salary DESC;
```

逻辑是：

* `current_dept_emp` 负责当前部门
* `salary` 负责当前工资
* `department` 负责部门名翻译

---

### 12）查各岗位当前平均薪资

```sql
SELECT
    t.title,
    ROUND(AVG(s.amount), 2) AS avg_salary
FROM title t
JOIN salary s
    ON t.emp_no = s.emp_no
WHERE t.to_date = DATE '9999-01-01'
  AND s.to_date = DATE '9999-01-01'
GROUP BY t.title
ORDER BY avg_salary DESC;
```

这个很适合分析岗位与薪酬关系。

---

### 13）查当前部门 + 当前岗位 + 当前薪资（员工画像）

```sql
SELECT
    e.emp_no,
    e.first_name,
    e.last_name,
    d.dept_name,
    t.title,
    s.amount
FROM employee e
JOIN current_dept_emp c
    ON e.emp_no = c.emp_no
JOIN department d
    ON c.dept_no = d.dept_no
JOIN title t
    ON e.emp_no = t.emp_no
JOIN salary s
    ON e.emp_no = s.emp_no
WHERE t.to_date = DATE '9999-01-01'
  AND s.to_date = DATE '9999-01-01'
ORDER BY e.emp_no
LIMIT 50;
```

这几乎就是一个“员工当前状态总览”。

---

### 14）查发生过部门调动的员工

```sql
SELECT
    emp_no,
    COUNT(*) AS dept_history_count
FROM dept_emp
GROUP BY emp_no
HAVING COUNT(*) > 1
ORDER BY dept_history_count DESC, emp_no;
```

因为一个员工多条 `dept_emp` 记录，说明有跨部门流动。样例中 10010、10018、10029 等都符合。

---

### 15）查发生过岗位晋升/变化的员工

```sql
SELECT
    emp_no,
    COUNT(*) AS title_history_count
FROM title
GROUP BY emp_no
HAVING COUNT(*) > 1
ORDER BY title_history_count DESC, emp_no;
```

这能快速找出有岗位成长轨迹的人。

---

### 16）查从 Engineer 晋升到 Senior Engineer 的员工

```sql
SELECT DISTINCT t1.emp_no
FROM title t1
JOIN title t2
    ON t1.emp_no = t2.emp_no
WHERE t1.title = 'Engineer'
  AND t2.title = 'Senior Engineer'
  AND t1.from_date < t2.from_date
ORDER BY t1.emp_no;
```

适合做晋升分析入门。

---

### 17）计算从 Engineer 到 Senior Engineer 用了多久

```sql
SELECT
    t1.emp_no,
    t1.from_date AS engineer_start,
    t2.from_date AS senior_engineer_start,
    (t2.from_date - t1.from_date) AS days_to_promotion
FROM title t1
JOIN title t2
    ON t1.emp_no = t2.emp_no
WHERE t1.title = 'Engineer'
  AND t2.title = 'Senior Engineer'
  AND t2.from_date > t1.from_date
ORDER BY days_to_promotion;
```

这个很适合继续练窗口函数或统计平均晋升周期。

---

### 18）查入职年份分布

```sql
SELECT
    EXTRACT(YEAR FROM hire_date) AS hire_year,
    COUNT(*) AS hired_count
FROM employee
GROUP BY EXTRACT(YEAR FROM hire_date)
ORDER BY hire_year;
```

这可以看招聘高峰期。

---

### 19）查某部门当前员工明细

```sql
SELECT
    e.emp_no,
    e.first_name,
    e.last_name
FROM current_dept_emp c
JOIN employee e
    ON c.emp_no = e.emp_no
WHERE c.dept_no = 'd005'
ORDER BY e.emp_no;
```

比如 `d005` 是 `Development`。

---

### 20）查审计日志

```sql
SELECT
    id,
    operation,
    user_name,
    changed_at,
    query
FROM audit
ORDER BY changed_at DESC;
```

结合主脚本可知，当前主要会记录 `salary` 的更新与删除，并带上操作类别如 `UPDATE [payroll:high]`。

---

## 五、几个特别值得你掌握的 SQL 思维

### 1. “当前状态”不等于基础表

在这套库里，当前状态通常要靠条件取出来：

* 当前部门：`current_dept_emp`
* 当前岗位：`title.to_date = '9999-01-01'`
* 当前工资：`salary.to_date = '9999-01-01'`

这是这套库最核心的思维。

---

### 2. 多表 join 时要明确“历史”还是“当前”

比如你一旦把 `dept_emp`、`title`、`salary` 直接 join，而不限制当前有效记录，就会产生大量历史笛卡尔组合，结果会重复很多行。

所以最常见的正确写法是：

```sql
WHERE t.to_date = DATE '9999-01-01'
  AND s.to_date = DATE '9999-01-01'
```

如果部门也取当前，则用 `current_dept_emp`。

---

### 3. 先用视图再用事实表

这套库已经帮你把“当前部门”这个高频需求做成了视图，所以在写业务 SQL 时，优先从 `current_dept_emp` 入手更方便。

---

## 六、给你一版“学习顺序建议”

如果你要真正吃透这套库，我建议按这个顺序练：

第一步，单表查询：

* `employee`
* `department`

第二步，理解历史表：

* `dept_emp`
* `title`
* `salary`

第三步，做当前状态查询：

* 当前部门
* 当前岗位
* 当前工资

第四步，做综合画像：

* 当前部门 + 岗位 + 薪资

第五步，做分析题：

* 各部门人数
* 各岗位人数
* 各部门平均薪资
* 晋升路径分析
* 调岗分析

第六步，再看进阶对象：

* `current_dept_emp` 视图
* `audit` 审计
* 触发器
* RLS

---

## 七、一个最实用的“综合查询模板”

最后给你一个最像业务报表的模板：

```sql
SELECT
    e.emp_no,
    e.first_name,
    e.last_name,
    d.dept_name,
    t.title,
    s.amount AS current_salary,
    e.hire_date
FROM employee e
JOIN current_dept_emp c
    ON e.emp_no = c.emp_no
JOIN department d
    ON c.dept_no = d.dept_no
JOIN title t
    ON e.emp_no = t.emp_no
JOIN salary s
    ON e.emp_no = s.emp_no
WHERE t.to_date = DATE '9999-01-01'
  AND s.to_date = DATE '9999-01-01'
ORDER BY s.amount DESC, e.emp_no;
```

这个查询几乎把这套数据库最重要的几个对象全串起来了。
