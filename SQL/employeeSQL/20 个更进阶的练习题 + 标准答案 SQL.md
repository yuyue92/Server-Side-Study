下面这 20 题，我按“越来越像真实分析题”的顺序来排。

这套库的核心难点在于：`dept_emp`、`title`、`salary` 都是**历史表**，当前有效记录通常要用 `to_date = '9999-01-01'` 来筛。这个模式在样例数据里很明显，比如 `dept_emp` 中 10010 从 `d004` 转到 `d006`，当前记录就是 `to_date='9999-01-01'` 的那条；10018 也有类似调动历史。

---

# 1. 找出当前薪资高于公司当前平均薪资的员工

**考点**：子查询、当前状态筛选

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
  AND s.amount > (
      SELECT AVG(amount)
      FROM salary
      WHERE to_date = DATE '9999-01-01'
  )
ORDER BY s.amount DESC;
```

---

# 2. 找出当前每个部门薪资最高的员工

**考点**：CTE、分组最大值、多表联查

```sql
WITH current_emp AS (
    SELECT emp_no, dept_no
    FROM dept_emp
    WHERE to_date = DATE '9999-01-01'
),
current_salary AS (
    SELECT emp_no, amount
    FROM salary
    WHERE to_date = DATE '9999-01-01'
),
dept_max_salary AS (
    SELECT
        ce.dept_no,
        MAX(cs.amount) AS max_salary
    FROM current_emp ce
    JOIN current_salary cs
        ON ce.emp_no = cs.emp_no
    GROUP BY ce.dept_no
)
SELECT
    d.dept_name,
    e.emp_no,
    e.first_name,
    e.last_name,
    cs.amount
FROM dept_max_salary ms
JOIN current_emp ce
    ON ms.dept_no = ce.dept_no
JOIN current_salary cs
    ON ce.emp_no = cs.emp_no
   AND ms.max_salary = cs.amount
JOIN employee e
    ON ce.emp_no = e.emp_no
JOIN department d
    ON ms.dept_no = d.dept_no
ORDER BY d.dept_name, e.emp_no;
```

---

# 3. 找出当前每个部门薪资前三的员工

**考点**：窗口函数 `ROW_NUMBER()`

```sql
WITH current_data AS (
    SELECT
        d.dept_name,
        e.emp_no,
        e.first_name,
        e.last_name,
        s.amount,
        ROW_NUMBER() OVER (
            PARTITION BY d.dept_name
            ORDER BY s.amount DESC, e.emp_no
        ) AS rn
    FROM dept_emp de
    JOIN department d
        ON de.dept_no = d.dept_no
    JOIN employee e
        ON de.emp_no = e.emp_no
    JOIN salary s
        ON e.emp_no = s.emp_no
    WHERE de.to_date = DATE '9999-01-01'
      AND s.to_date = DATE '9999-01-01'
)
SELECT *
FROM current_data
WHERE rn <= 3
ORDER BY dept_name, rn;
```

---

# 4. 统计每个员工的涨薪次数

**考点**：历史表统计

```sql
SELECT
    e.emp_no,
    e.first_name,
    e.last_name,
    COUNT(*) - 1 AS raise_count
FROM employee e
JOIN salary s
    ON e.emp_no = s.emp_no
GROUP BY e.emp_no, e.first_name, e.last_name
HAVING COUNT(*) > 1
ORDER BY raise_count DESC, e.emp_no;
```

`salary` 明显是一张多期薪资历史表，同一员工会有多条记录。

---

# 5. 找出薪资记录最多的前 10 名员工

**考点**：排序、历史记录深度

```sql
SELECT
    e.emp_no,
    e.first_name,
    e.last_name,
    COUNT(*) AS salary_record_count
FROM employee e
JOIN salary s
    ON e.emp_no = s.emp_no
GROUP BY e.emp_no, e.first_name, e.last_name
ORDER BY salary_record_count DESC, e.emp_no
LIMIT 10;
```

---

# 6. 计算每个员工当前薪资相对其首份薪资增长了多少

**考点**：CTE、最早记录、当前记录对比

```sql
WITH first_salary AS (
    SELECT DISTINCT ON (emp_no)
        emp_no,
        amount AS first_amount
    FROM salary
    ORDER BY emp_no, from_date
),
current_salary AS (
    SELECT
        emp_no,
        amount AS current_amount
    FROM salary
    WHERE to_date = DATE '9999-01-01'
)
SELECT
    e.emp_no,
    e.first_name,
    e.last_name,
    fs.first_amount,
    cs.current_amount,
    cs.current_amount - fs.first_amount AS growth_amount
FROM employee e
JOIN first_salary fs
    ON e.emp_no = fs.emp_no
JOIN current_salary cs
    ON e.emp_no = cs.emp_no
ORDER BY growth_amount DESC, e.emp_no;
```

---

# 7. 计算每个员工当前薪资相对首份薪资的增长比例

**考点**：比例计算、防止整型截断

```sql
WITH first_salary AS (
    SELECT DISTINCT ON (emp_no)
        emp_no,
        amount AS first_amount
    FROM salary
    ORDER BY emp_no, from_date
),
current_salary AS (
    SELECT
        emp_no,
        amount AS current_amount
    FROM salary
    WHERE to_date = DATE '9999-01-01'
)
SELECT
    e.emp_no,
    e.first_name,
    e.last_name,
    fs.first_amount,
    cs.current_amount,
    ROUND(
        (cs.current_amount - fs.first_amount) * 100.0 / fs.first_amount,
        2
    ) AS growth_pct
FROM employee e
JOIN first_salary fs
    ON e.emp_no = fs.emp_no
JOIN current_salary cs
    ON e.emp_no = cs.emp_no
ORDER BY growth_pct DESC, e.emp_no;
```

---

# 8. 找出发生过部门调动的员工及调动次数

**考点**：历史关系表分析

`dept_emp` 里存在多次入部门记录，例如 10010、10018、10029 都有两段部门历史。

```sql
SELECT
    e.emp_no,
    e.first_name,
    e.last_name,
    COUNT(*) - 1 AS transfer_count
FROM employee e
JOIN dept_emp de
    ON e.emp_no = de.emp_no
GROUP BY e.emp_no, e.first_name, e.last_name
HAVING COUNT(*) > 1
ORDER BY transfer_count DESC, e.emp_no;
```

---

# 9. 找出当前部门与入职时首个部门不同的员工

**考点**：首条记录 vs 当前记录

```sql
WITH first_dept AS (
    SELECT DISTINCT ON (emp_no)
        emp_no,
        dept_no AS first_dept_no
    FROM dept_emp
    ORDER BY emp_no, from_date
),
current_dept AS (
    SELECT
        emp_no,
        dept_no AS current_dept_no
    FROM dept_emp
    WHERE to_date = DATE '9999-01-01'
)
SELECT
    e.emp_no,
    e.first_name,
    e.last_name,
    fd.first_dept_no,
    cd.current_dept_no
FROM employee e
JOIN first_dept fd
    ON e.emp_no = fd.emp_no
JOIN current_dept cd
    ON e.emp_no = cd.emp_no
WHERE fd.first_dept_no <> cd.current_dept_no
ORDER BY e.emp_no;
```

---

# 10. 找出岗位发生过变化的员工，并显示变化次数

**考点**：岗位历史统计

```sql
SELECT
    e.emp_no,
    e.first_name,
    e.last_name,
    COUNT(*) - 1 AS title_change_count
FROM employee e
JOIN title t
    ON e.emp_no = t.emp_no
GROUP BY e.emp_no, e.first_name, e.last_name
HAVING COUNT(*) > 1
ORDER BY title_change_count DESC, e.emp_no;
```

`title` 是标准岗位历史表，可用于看晋升路径。

---

# 11. 找出从 Engineer 晋升到 Senior Engineer 的员工

**考点**：自连接、职业路径识别

```sql
SELECT DISTINCT
    e.emp_no,
    e.first_name,
    e.last_name
FROM employee e
JOIN title t1
    ON e.emp_no = t1.emp_no
JOIN title t2
    ON e.emp_no = t2.emp_no
WHERE t1.title = 'Engineer'
  AND t2.title = 'Senior Engineer'
  AND t2.from_date > t1.from_date
ORDER BY e.emp_no;
```

---

# 12. 计算从 Engineer 到 Senior Engineer 的晋升天数

**考点**：时间差

```sql
WITH engineer_start AS (
    SELECT
        emp_no,
        MIN(from_date) AS engineer_date
    FROM title
    WHERE title = 'Engineer'
    GROUP BY emp_no
),
senior_start AS (
    SELECT
        emp_no,
        MIN(from_date) AS senior_date
    FROM title
    WHERE title = 'Senior Engineer'
    GROUP BY emp_no
)
SELECT
    e.emp_no,
    e.first_name,
    e.last_name,
    es.engineer_date,
    ss.senior_date,
    (ss.senior_date - es.engineer_date) AS days_to_promotion
FROM employee e
JOIN engineer_start es
    ON e.emp_no = es.emp_no
JOIN senior_start ss
    ON e.emp_no = ss.emp_no
WHERE ss.senior_date > es.engineer_date
ORDER BY days_to_promotion, e.emp_no;
```

---

# 13. 统计当前每个岗位在每个部门的人数

**考点**：三表当前状态拼接

```sql
SELECT
    d.dept_name,
    t.title,
    COUNT(*) AS cnt
FROM dept_emp de
JOIN department d
    ON de.dept_no = d.dept_no
JOIN title t
    ON de.emp_no = t.emp_no
WHERE de.to_date = DATE '9999-01-01'
  AND t.to_date = DATE '9999-01-01'
GROUP BY d.dept_name, t.title
ORDER BY d.dept_name, cnt DESC, t.title;
```

---

# 14. 统计当前每个部门的男女员工人数

**考点**：条件聚合

`employee` 表包含 `gender` 字段，样例里只允许 `M/F`。

```sql
SELECT
    d.dept_name,
    SUM(CASE WHEN e.gender = 'M' THEN 1 ELSE 0 END) AS male_count,
    SUM(CASE WHEN e.gender = 'F' THEN 1 ELSE 0 END) AS female_count
FROM dept_emp de
JOIN department d
    ON de.dept_no = d.dept_no
JOIN employee e
    ON de.emp_no = e.emp_no
WHERE de.to_date = DATE '9999-01-01'
GROUP BY d.dept_name
ORDER BY d.dept_name;
```

---

# 15. 找出当前薪资高于本部门平均薪资的员工

**考点**：部门内比较、CTE

```sql
WITH current_emp_salary AS (
    SELECT
        de.dept_no,
        e.emp_no,
        e.first_name,
        e.last_name,
        s.amount
    FROM dept_emp de
    JOIN employee e
        ON de.emp_no = e.emp_no
    JOIN salary s
        ON e.emp_no = s.emp_no
    WHERE de.to_date = DATE '9999-01-01'
      AND s.to_date = DATE '9999-01-01'
),
dept_avg AS (
    SELECT
        dept_no,
        AVG(amount) AS avg_amount
    FROM current_emp_salary
    GROUP BY dept_no
)
SELECT
    d.dept_name,
    ces.emp_no,
    ces.first_name,
    ces.last_name,
    ces.amount,
    ROUND(da.avg_amount, 2) AS dept_avg_amount
FROM current_emp_salary ces
JOIN dept_avg da
    ON ces.dept_no = da.dept_no
JOIN department d
    ON ces.dept_no = d.dept_no
WHERE ces.amount > da.avg_amount
ORDER BY d.dept_name, ces.amount DESC;
```

---

# 16. 找出当前各部门平均薪资最高的前 3 个部门

**考点**：聚合排序

```sql
SELECT
    d.dept_name,
    ROUND(AVG(s.amount), 2) AS avg_salary
FROM dept_emp de
JOIN department d
    ON de.dept_no = d.dept_no
JOIN salary s
    ON de.emp_no = s.emp_no
WHERE de.to_date = DATE '9999-01-01'
  AND s.to_date = DATE '9999-01-01'
GROUP BY d.dept_name
ORDER BY avg_salary DESC
LIMIT 3;
```

---

# 17. 找出任职时间最长的当前员工

**考点**：日期计算

员工主表保存 `hire_date`。例如 10009 的入职日期是 1985-02-18，10001 是 1986-06-26。

```sql
SELECT
    emp_no,
    first_name,
    last_name,
    hire_date,
    (CURRENT_DATE - hire_date) AS days_employed
FROM employee
ORDER BY hire_date
LIMIT 20;
```

如果你想找“当前仍在职且工龄最长”，这套样例库通常默认主表员工都在职，可直接按 `hire_date` 排。

---

# 18. 统计每年入职人数，并找出招聘高峰年

**考点**：按年聚合

```sql
SELECT
    EXTRACT(YEAR FROM hire_date) AS hire_year,
    COUNT(*) AS hired_count
FROM employee
GROUP BY EXTRACT(YEAR FROM hire_date)
ORDER BY hired_count DESC, hire_year;
```

---

# 19. 找出薪资曾经下降过的员工

**考点**：窗口函数 `LAG()`

这题很有价值，因为它不只是“涨薪”，而是识别历史中的异常或波动。

```sql
WITH salary_change AS (
    SELECT
        emp_no,
        from_date,
        amount,
        LAG(amount) OVER (
            PARTITION BY emp_no
            ORDER BY from_date
        ) AS prev_amount
    FROM salary
)
SELECT DISTINCT
    e.emp_no,
    e.first_name,
    e.last_name
FROM salary_change sc
JOIN employee e
    ON sc.emp_no = e.emp_no
WHERE sc.prev_amount IS NOT NULL
  AND sc.amount < sc.prev_amount
ORDER BY e.emp_no;
```

从样例数据片段里就能看到有的员工某些年度薪资并非单调上升，比如 10174 曾从 81394 降到 81262。

---

# 20. 做一张“当前员工全景表”：部门、岗位、薪资、工龄、是否经理

**考点**：综合报表、左连接、条件判断

```sql
WITH current_dept AS (
    SELECT emp_no, dept_no
    FROM dept_emp
    WHERE to_date = DATE '9999-01-01'
),
current_title AS (
    SELECT emp_no, title
    FROM title
    WHERE to_date = DATE '9999-01-01'
),
current_salary AS (
    SELECT emp_no, amount
    FROM salary
    WHERE to_date = DATE '9999-01-01'
),
current_manager AS (
    SELECT emp_no, dept_no
    FROM dept_manager
    WHERE to_date = DATE '9999-01-01'
)
SELECT
    e.emp_no,
    e.first_name,
    e.last_name,
    d.dept_name,
    ct.title,
    cs.amount AS current_salary,
    (CURRENT_DATE - e.hire_date) AS days_employed,
    CASE
        WHEN cm.emp_no IS NOT NULL THEN 'Y'
        ELSE 'N'
    END AS is_manager
FROM employee e
JOIN current_dept cd
    ON e.emp_no = cd.emp_no
JOIN department d
    ON cd.dept_no = d.dept_no
JOIN current_title ct
    ON e.emp_no = ct.emp_no
JOIN current_salary cs
    ON e.emp_no = cs.emp_no
LEFT JOIN current_manager cm
    ON e.emp_no = cm.emp_no
   AND cd.dept_no = cm.dept_no
ORDER BY cs.amount DESC, e.emp_no;
```

这题基本把整套库最核心的关系都串起来了。

---

## 再补 5 个“很像面试题”的变体

### A. 找出没有发生过部门调动的员工

```sql
SELECT
    e.emp_no,
    e.first_name,
    e.last_name
FROM employee e
JOIN dept_emp de
    ON e.emp_no = de.emp_no
GROUP BY e.emp_no, e.first_name, e.last_name
HAVING COUNT(*) = 1
ORDER BY e.emp_no;
```

### B. 找出当前工资高于当前经理工资的员工

```sql
WITH current_emp AS (
    SELECT emp_no, dept_no
    FROM dept_emp
    WHERE to_date = DATE '9999-01-01'
),
current_mgr AS (
    SELECT emp_no, dept_no
    FROM dept_manager
    WHERE to_date = DATE '9999-01-01'
),
current_sal AS (
    SELECT emp_no, amount
    FROM salary
    WHERE to_date = DATE '9999-01-01'
)
SELECT
    d.dept_name,
    e.emp_no,
    e.first_name,
    e.last_name,
    es.amount AS emp_salary,
    m.emp_no AS mgr_emp_no,
    ms.amount AS mgr_salary
FROM current_emp ce
JOIN current_mgr cm
    ON ce.dept_no = cm.dept_no
JOIN current_sal es
    ON ce.emp_no = es.emp_no
JOIN current_sal ms
    ON cm.emp_no = ms.emp_no
JOIN employee e
    ON ce.emp_no = e.emp_no
JOIN department d
    ON ce.dept_no = d.dept_no
JOIN employee m
    ON cm.emp_no = m.emp_no
WHERE ce.emp_no <> cm.emp_no
  AND es.amount > ms.amount
ORDER BY d.dept_name, es.amount DESC;
```

### C. 统计每个部门历史上出现过多少位经理

```sql
SELECT
    d.dept_name,
    COUNT(DISTINCT dm.emp_no) AS manager_count
FROM dept_manager dm
JOIN department d
    ON dm.dept_no = d.dept_no
GROUP BY d.dept_name
ORDER BY manager_count DESC, d.dept_name;
```

### D. 找出部门停留时间最长的单段任职记录

```sql
SELECT
    de.emp_no,
    e.first_name,
    e.last_name,
    d.dept_name,
    de.from_date,
    de.to_date,
    (de.to_date - de.from_date) AS days_in_dept
FROM dept_emp de
JOIN employee e
    ON de.emp_no = e.emp_no
JOIN department d
    ON de.dept_no = d.dept_no
ORDER BY days_in_dept DESC
LIMIT 20;
```

### E. 统计当前每个部门当前每个岗位的平均薪资

```sql
SELECT
    d.dept_name,
    t.title,
    ROUND(AVG(s.amount), 2) AS avg_salary
FROM dept_emp de
JOIN department d
    ON de.dept_no = d.dept_no
JOIN title t
    ON de.emp_no = t.emp_no
JOIN salary s
    ON de.emp_no = s.emp_no
WHERE de.to_date = DATE '9999-01-01'
  AND t.to_date = DATE '9999-01-01'
  AND s.to_date = DATE '9999-01-01'
GROUP BY d.dept_name, t.title
ORDER BY d.dept_name, avg_salary DESC;
```

---

## 这 20 题主要覆盖了什么能力

如果你把这组题做熟，基本上就把这套库最重要的 SQL 能力练到了：

* 单表 + 多表 join
* 当前状态与历史状态切换
* 聚合与分组
* 子查询
* CTE
* 窗口函数 `ROW_NUMBER()` / `LAG()`
* 历史路径分析
* 晋升分析
* 调岗分析
* 薪资分析
* 综合报表设计

---

## 建议你的练习顺序

最推荐的顺序是：

1. 先做 1、4、8、10、18
2. 再做 2、3、9、13、15、16
3. 最后做 11、12、19、20 和 5 个变体题

因为前一组主要是基本聚合和历史表理解，后一组才真正进入“分析型 SQL”。

---

## 20 题做成“逐题讲解版”

下面我把这 20 题做成“逐题讲解版”。

我会固定用这 4 个角度来讲每题：

* **这题在考什么**
* **为什么 SQL 要这样写**
* **最容易错在哪**
* **怎么再升级**

先记住这套库最重要的底层规则：

* `dept_emp`、`title`、`salary` 都是**历史表**，不是只存当前值的表；当前记录通常用 `to_date = '9999-01-01'` 来识别。这个模式在建表和样例数据里都非常明确，`salary` 的主键是 `(emp_no, from_date)`，`title` 的主键是 `(emp_no, title, from_date)`，说明它们天然允许一人多段历史；而视图 `current_dept_emp` 也是从 `dept_emp` 历史里推当前部门。
* 样例数据也能直接看到这种“历史 + 当前”的写法：比如 10010 在 `dept_emp` 里先在 `d004`，后转到 `d006`，后一条的 `to_date='9999-01-01'` 才是当前部门；`title` 里 10004 先是 `Engineer`，后是 `Senior Engineer`；`salary` 里同一员工会有多条连续薪资记录。  

---

## 1）找出当前薪资高于公司当前平均薪资的员工

### 这题在考什么

考的是最基础但非常常用的分析模式：

* 先定义“当前薪资”
* 再拿每个人和“总体平均值”比较

### 为什么 SQL 要这样写

关键在这里：

```sql
WHERE s.to_date = DATE '9999-01-01'
```

因为 `salary` 是历史表，不加这个条件，你算出来的就不是“当前平均薪资”，而是“历史所有薪资记录的平均”。那会把很多旧工资也混进去，口径直接错掉。`salary` 的历史结构在表定义和样例数据里都很清楚。 

子查询：

```sql
SELECT AVG(amount)
FROM salary
WHERE to_date = DATE '9999-01-01'
```

相当于先算公司当前整体均值，再和每个人当前值比较。

### 最容易错在哪

最常见的错有两个：

第一，忘了子查询里也要加 `to_date='9999-01-01'`。
你主查询筛了当前，但子查询没筛，比较基准还是历史平均，结果仍然不对。

第二，把 `AVG(amount)` 放进 `GROUP BY emp_no` 的查询里硬写，导致逻辑混乱。
这题其实是“个人值 vs 全公司单一均值”，子查询最直观。

### 怎么再升级

可以继续改成：

* 高于本部门平均薪资
* 高于本岗位平均薪资
* 高于公司平均薪资 20% 以上

---

## 2）找出当前每个部门薪资最高的员工

### 这题在考什么

考“**分组最大值**怎么回表取明细”。

### 为什么 SQL 要这样写

之所以拆成 3 个 CTE：

* `current_emp`
* `current_salary`
* `dept_max_salary`

是为了把逻辑切干净：

1. 先确定“当前在哪个部门”
2. 再确定“当前工资是多少”
3. 再求每个部门最大工资
4. 最后把最大工资对应回具体员工

因为“最大值”本身只给你数，不给你人。

### 最容易错在哪

最大坑是直接写：

```sql
SELECT dept_no, emp_no, MAX(amount)
FROM ...
GROUP BY dept_no;
```

这在 SQL 语义上通常不成立，因为 `emp_no` 既没聚合也没分组。
就算某些数据库放过了，也是不可靠结果。

第二个坑是没筛当前部门和当前薪资。
这样一个员工历史部门 + 历史工资会交叉组合，严重重复。

### 怎么再升级

如果出现并列最高薪，这个写法会把并列员工都查出来。
如果你只想保留一个人，就要加 `ROW_NUMBER()` 强行选 1 个。

---

## 3）找出当前每个部门薪资前三的员工

### 这题在考什么

考窗口函数 `ROW_NUMBER()` 的分组排名。

### 为什么 SQL 要这样写

核心是：

```sql
ROW_NUMBER() OVER (
    PARTITION BY d.dept_name
    ORDER BY s.amount DESC, e.emp_no
) AS rn
```

意思是：

* 每个部门单独排名
* 按工资从高到低排
* 工资相同再按 `emp_no` 稳定排序

然后外层 `WHERE rn <= 3` 取前三。

### 最容易错在哪

很多人会误写成：

```sql
ORDER BY s.amount DESC LIMIT 3
```

这只能取**全公司前三**，不是每部门前三。

第二个坑是 `ROW_NUMBER()`、`RANK()`、`DENSE_RANK()` 混淆：

* `ROW_NUMBER()`：不管并列，名次唯一
* `RANK()`：并列跳号
* `DENSE_RANK()`：并列不跳号

你要“每部门最多 3 行”，选 `ROW_NUMBER()` 最稳。

### 怎么再升级

可以改成：

* 每部门前 5 名
* 每部门薪资后 3 名
* 每部门薪资前 10% 的员工

---

## 4）统计每个员工的涨薪次数

### 这题在考什么

考的是：如何从历史薪资记录数反推“调薪次数”。

### 为什么 SQL 要这样写

如果一个员工有 N 条薪资记录，意味着经历了 N-1 次变更。
所以：

```sql
COUNT(*) - 1 AS raise_count
```

是合理近似。

比如 `salary` 里 10001 就有很多连续记录，从 1986 到当前多次变动，明显不是单条工资。

### 最容易错在哪

严格说，这题名字叫“涨薪次数”，但 SQL 实际算的是“薪资变更次数”，不一定每次都是上涨。
因为样例数据里也确实存在下降，例如 10012 从 54794 到 54423，10013 也有下降片段。

所以这个写法更准确的名字应该叫：

* `salary_change_count`
* 或 `salary_record_count - 1`

### 怎么再升级

想算**真正的涨薪次数**，要用 `LAG(amount)` 比较前后两条，只统计 `amount > prev_amount`。

---

## 5）找出薪资记录最多的前 10 名员工

### 这题在考什么

考的是“谁的历史最丰富”。

### 为什么 SQL 要这样写

这题很直接：

```sql
COUNT(*) AS salary_record_count
```

因为 `salary` 一条记录就是一个有效期片段。记录越多，说明这个人被调薪越频繁，或者在职越久。

### 最容易错在哪

不要把“记录最多”误解成“当前工资最高”。
这是两个完全不同的维度：

* 一个是历史深度
* 一个是当前金额

### 怎么再升级

你可以再除以在职年限，算“平均每年调薪次数”，更公平。

---

## 6）计算每个员工当前薪资相对其首份薪资增长了多少

### 这题在考什么

考“首条记录 vs 当前记录”的对比。

### 为什么 SQL 要这样写

这里最关键的是 `DISTINCT ON (emp_no)`：

```sql
SELECT DISTINCT ON (emp_no)
    emp_no,
    amount AS first_amount
FROM salary
ORDER BY emp_no, from_date
```

在 PostgreSQL 里，这是一种很好用的“每组取第一条”写法。
按 `from_date` 升序，第一条就是首薪。

当前工资则直接取：

```sql
WHERE to_date = DATE '9999-01-01'
```

最后相减：

```sql
cs.current_amount - fs.first_amount
```

### 最容易错在哪

第一，`DISTINCT ON` 必须配合正确的 `ORDER BY`。
如果你排序没写好，取到的就不一定是第一条。

第二，很多人会误用 `MIN(amount)` 当首薪。
这是错的。首薪不是最低薪，必须按**时间最早**取，不是按金额最小取。

### 怎么再升级

可以继续算：

* 首薪到现薪年化增长
* 首薪到现薪增长金额排名
* 部门平均增长金额

---

## 7）计算每个员工当前薪资相对首份薪资的增长比例

### 这题在考什么

和第 6 题一样，但多了比例计算。

### 为什么 SQL 要这样写

关键是：

```sql
(cs.current_amount - fs.first_amount) * 100.0 / fs.first_amount
```

这里用 `100.0` 而不是 `100`，是为了触发小数运算，避免整型截断。

### 最容易错在哪

如果写成：

```sql
(current - first) / first * 100
```

在某些数据库里如果都是整数，可能先整除，结果变成 0。

### 怎么再升级

还可以算：

* 薪资 CAGR（复合年增长率）
* 各部门平均增长率
* 各岗位平均增长率

---

## 8）找出发生过部门调动的员工及调动次数

### 这题在考什么

考 `dept_emp` 的历史理解。

### 为什么 SQL 要这样写

`dept_emp` 一个人多条记录，说明部门归属发生过变化。
例如 10010 从 `d004` 到 `d006`，10018 从 `d005` 到 `d004`，10029 从 `d004` 到 `d006`。

所以：

```sql
COUNT(*) - 1 AS transfer_count
```

表示调动次数。

### 最容易错在哪

这题依然存在一个“口径细节”：

* SQL 算的是“部门历史段数 - 1”
* 通常可近似理解为调动次数

但如果底层数据未来允许“离职再返岗同部门”之类情况，就不一定完全等于“跨部门调动次数”。

### 怎么再升级

可以把调动路径也列出来，比如：

* 首部门
* 当前部门
* 历史部门数
* 完整路径字符串

---

## 9）找出当前部门与入职时首个部门不同的员工

### 这题在考什么

考“首条部门记录”和“当前部门记录”的对比。

### 为什么 SQL 要这样写

逻辑是：

* `first_dept`：按 `from_date` 最早取第一条
* `current_dept`：`to_date='9999-01-01'`

然后比较：

```sql
WHERE fd.first_dept_no <> cd.current_dept_no
```

这类题本质上就是“人生起点 vs 当前状态”。

### 最容易错在哪

最常见错误是把“首部门”写成：

```sql
MIN(dept_no)
```

这完全不对。首部门是按时间最早，不是部门编号最小。

### 怎么再升级

你可以再补上部门名，甚至算：

* 从首部门到当前部门跨了多少次
* 哪些部门最容易成为“起点部门”
* 哪些部门最容易成为“终点部门”

---

## 10）找出岗位发生过变化的员工，并显示变化次数

### 这题在考什么

考 `title` 历史表的用法。

### 为什么 SQL 要这样写

和薪资、部门题一样，`COUNT(*) - 1` 表示岗位变化次数。
样例里能明显看到很多员工有两段 title，例如 10004 从 `Engineer` 到 `Senior Engineer`，10005 从 `Staff` 到 `Senior Staff`。

### 最容易错在哪

同样不要把“title 记录数 > 1”机械理解成“晋升次数”。
它更准确是“岗位变化次数”。
因为理论上也可能平调、降级、短期特殊 title。

### 怎么再升级

可以继续做：

* 只统计“向上晋升”
* 统计从 `Engineer -> Senior Engineer` 的人数
* 找出 title 变化最多的人

---

## 11）找出从 Engineer 晋升到 Senior Engineer 的员工

### 这题在考什么

考 `title` 自连接。

### 为什么 SQL 要这样写

核心思路是：同一个员工在 `title` 里同时存在两种 title，并且后者时间更晚。

```sql
JOIN title t1
JOIN title t2
WHERE t1.title = 'Engineer'
  AND t2.title = 'Senior Engineer'
  AND t2.from_date > t1.from_date
```

样例里 10004、10012、10018 都符合这个模式。

### 最容易错在哪

第一，忘记加：

```sql
t2.from_date > t1.from_date
```

不加的话，只要一个人两种 title 都存在，就会连出来，甚至可能连出不合理组合。

第二，可能重复。
如果一个人历史复杂，可能匹配多次，所以这里用了 `DISTINCT`。

### 怎么再升级

可以继续限制为：

* 当前已经是 `Senior Engineer`
* 且从未当过别的技术 title
* 晋升周期少于 5 年

---

## 12）计算从 Engineer 到 Senior Engineer 的晋升天数

### 这题在考什么

考“同一路径两个关键节点之间的时间差”。

### 为什么 SQL 要这样写

先分别取：

* 最早成为 `Engineer` 的日期
* 最早成为 `Senior Engineer` 的日期

然后相减。

这比直接在明细表里乱连更稳，因为你明确只要每人各自的“起点”和“目标节点”。

### 最容易错在哪

最大坑是：如果一个员工未来可能多次拿到同一 title，或者标题历史复杂，直接自连接很容易一人多行。
用 `MIN(from_date)` 先压缩成一个节点，就更干净。

### 怎么再升级

可以进一步算：

* 平均晋升天数
* 各部门晋升天数
* 晋升速度前 10 名

---

## 13）统计当前每个岗位在每个部门的人数

### 这题在考什么

考三个“当前状态”表的交叉。

### 为什么 SQL 要这样写

这题其实在做二维交叉统计：

* 维度一：部门
* 维度二：岗位
* 指标：人数

所以需要同时限定：

```sql
de.to_date = '9999-01-01'
t.to_date = '9999-01-01'
```

否则你会把历史部门和历史岗位全混起来。

### 最容易错在哪

最常见错误是漏掉其中一个当前条件。
比如部门用了当前，岗位没用当前，那么一个当前在 d005 的员工，可能把以前旧 title 也算进来。

### 怎么再升级

可以做成矩阵报表，或者透视表形式输出。

---

## 14）统计当前每个部门的男女员工人数

### 这题在考什么

考条件聚合。

### 为什么 SQL 要这样写

因为需要在一条结果里同时统计男女人数，所以常见写法就是：

```sql
SUM(CASE WHEN e.gender = 'M' THEN 1 ELSE 0 END)
SUM(CASE WHEN e.gender = 'F' THEN 1 ELSE 0 END)
```

建表里 `gender` 被约束为 `M/F`。

### 最容易错在哪

不要忘了部门也必须取当前：

```sql
de.to_date = '9999-01-01'
```

否则同一个历史跨部门员工会被重复统计。

### 怎么再升级

还可以继续算：

* 男女平均薪资
* 各部门性别占比
* 各岗位性别分布

---

## 15）找出当前薪资高于本部门平均薪资的员工

### 这题在考什么

考“组内比较”。

### 为什么 SQL 要这样写

这题比第 1 题难一点，因为比较基准不再是全公司，而是“本部门平均”。

所以先做当前部门 + 当前工资的明细表：

```sql
current_emp_salary
```

再按部门算平均：

```sql
dept_avg
```

最后把个人工资和自己部门均值对比。

### 最容易错在哪

最典型的坑是把全公司平均和部门平均混用。
第二个坑是 join 条件写错，导致拿去和别的部门均值比。

### 怎么再升级

可以改成：

* 高于本部门平均 10%
* 高于本部门中位数
* 部门内薪资排名前 20%

---

## 16）找出当前各部门平均薪资最高的前 3 个部门

### 这题在考什么

考“部门聚合后排序”。

### 为什么 SQL 要这样写

这题只需要：

* 当前部门
* 当前工资
* 分组求平均
* 降序取前 3

是标准的聚合排序题。

### 最容易错在哪

最容易漏的是两个当前条件：

```sql
de.to_date = '9999-01-01'
s.to_date = '9999-01-01'
```

只要漏一个，部门均值口径就不纯。

### 怎么再升级

可以同时输出：

* 人数
* 薪资标准差
* 最高薪 / 最低薪

这样更像正式分析报告。

---

## 17）找出任职时间最长的当前员工

### 这题在考什么

考日期差计算。

### 为什么 SQL 要这样写

员工主表里有 `hire_date`，它本身就代表入职日期。建表定义也很明确。

所以：

```sql
CURRENT_DATE - hire_date
```

就能得到任职天数。

### 最容易错在哪

这题的一个语义细节是：
这套样例没有单独的“离职表”，所以通常默认主表里的人是当前员工。
如果现实库里有离职逻辑，不能这么简单写。

### 怎么再升级

可以补：

* 任职年数
* 按部门的最长工龄员工
* 工龄分布直方统计

---

## 18）统计每年入职人数，并找出招聘高峰年

### 这题在考什么

考时间维度聚合。

### 为什么 SQL 要这样写

核心是：

```sql
EXTRACT(YEAR FROM hire_date)
```

先把日期抽成年份，再分组统计。

### 最容易错在哪

很多人会先格式化成字符串再分组，这样虽然能做，但没必要，也更笨重。
直接 `EXTRACT` 最清晰。

### 怎么再升级

可以继续做：

* 按月入职人数
* 每年同比增长
* 招聘高峰年份 Top N

---

## 19）找出薪资曾经下降过的员工

### 这题在考什么

考窗口函数 `LAG()`，也是这组里最有分析味的一题。

### 为什么 SQL 要这样写

核心是：

```sql
LAG(amount) OVER (
    PARTITION BY emp_no
    ORDER BY from_date
) AS prev_amount
```

意思是：
对每个员工，按时间排序，取上一条工资。

然后判断：

```sql
amount < prev_amount
```

这才是真正意义上的“降薪”。

样例里确实存在这种情况，比如 10012 从 54794 到 54423，10013 也有若干下降，说明这题不是空想。

### 最容易错在哪

第一，窗口函数一定要 `PARTITION BY emp_no`。
不分员工的话，上一条工资可能取到别人的。

第二，排序一定要按时间。
按金额排序完全没有意义。

### 怎么再升级

可以做：

* 每次降薪幅度
* 最大单次降薪
* 发生降薪次数

---

## 20）做一张“当前员工全景表”：部门、岗位、薪资、工龄、是否经理

### 这题在考什么

考综合报表拼装能力。

### 为什么 SQL 要这样写

这题本质是把多个“当前状态”拼成一张宽表：

* 当前部门：`dept_emp`
* 当前岗位：`title`
* 当前工资：`salary`
* 当前经理身份：`dept_manager`

其中 `dept_manager` 也是历史表，样例里一个部门会有多任经理，当前经理同样由 `to_date='9999-01-01'` 识别，比如 `d001` 当前是 10039，`d004` 当前是 10420。

这里用 `LEFT JOIN current_manager` 很关键，因为不是每个人都是经理。
如果你用内连接，普通员工会被过滤掉。

### 最容易错在哪

第一，`is_manager` 一定要用左连接判断是否存在。
第二，这里最好把经理 join 条件写成：

```sql
ON e.emp_no = cm.emp_no
AND cd.dept_no = cm.dept_no
```

这样才能表示“这个员工是不是自己当前部门的经理”。

### 怎么再升级

这张表已经很接近 BI 宽表了。
你还可以继续补：

* 性别
* 入职年份
* 首薪
* 薪资增长率
* 调岗次数
* title 变化次数

---

# 再给你一组“通用易错点总结”

这 20 题里最容易反复犯错的，本质就 6 类。

## 1）把历史表当当前表

这是最大坑。
`dept_emp`、`title`、`salary` 都不是一人一条，而是一人多条历史。建模本身就是这么设计的。

只要题目问“当前”，你脑子里就要先亮灯：

```sql
to_date = DATE '9999-01-01'
```

---

## 2）把“第一条记录”误写成最小金额 / 最小编号

比如首薪、首部门、首岗位，都应该按**最早时间**取，不是按值最小取。

---

## 3）多表 join 后重复行爆炸

如果同时把 `dept_emp`、`title`、`salary` 的历史全 join 在一起，不加当前条件，结果行数会成倍增长。
这是时态表最经典的坑。

---

## 4）组内 Top N 用错成全局 Top N

`LIMIT 3` 只能取全局前三。
“每部门前三”必须用窗口函数。

---

## 5）把“变更次数”误叫“涨薪次数”或“晋升次数”

`COUNT(*) - 1` 通常只能说明“历史段变化次数”，不一定都是向上变化。
尤其 `salary` 样例中确实有下降记录。

---

## 6）经理身份要用左连接判断

因为多数员工不是经理。
`LEFT JOIN + CASE WHEN cm.emp_no IS NOT NULL THEN 'Y'` 是标准写法。

---

# 给你一版“做题心法”

以后你拿到这套库的新题，可以按这套顺序想：

**第一步：先问自己，这题是查当前，还是查历史？**
如果是当前，先找 `to_date='9999-01-01'`。

**第二步：先确定主事实表。**
比如：

* 薪资题主表是 `salary`
* 调岗题主表是 `dept_emp`
* 晋升题主表是 `title`

**第三步：再补维度表。**
比如：

* 姓名去 `employee`
* 部门名去 `department`

**第四步：最后才做聚合 / 排名 / 比较。**

这样思路会稳很多。

