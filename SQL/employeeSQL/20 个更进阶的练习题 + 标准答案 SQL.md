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
