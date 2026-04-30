/* ===== State ===== */
const state = {
  currentPage: 1,
  pageSize: 15,
  totalPages: 1,
  currentStudentId: null,
};

/* ===== Clock ===== */
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }) +
    '  ' + now.toLocaleTimeString('zh-CN');
}
setInterval(updateClock, 1000);
updateClock();

/* ===== Page Navigation ===== */
const pageTitles = {
  dashboard: '数据总览',
  list: '学生档案',
  add: '录入学生',
};

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById('page-' + name).classList.add('active');
  document.querySelector(`[data-page="${name}"]`)?.classList.add('active');
  document.getElementById('page-title').textContent = pageTitles[name] || name;

  if (name === 'dashboard') loadStats();
  if (name === 'list') searchStudents();
  if (name === 'add') {
    const isEdit = document.getElementById('edit-mode').value === 'edit';
    if (!isEdit) {
      resetForm();
      document.getElementById('form-title').textContent = '录入新学生';
    }
  }
}

/* ===== Toast ===== */
let toastTimer;
function toast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ===== API helpers ===== */
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

/* ===== Dashboard ===== */
async function loadStats() {
  try {
    const d = await api('GET', '/stats');
    document.getElementById('stat-total').textContent = d.total ?? 0;
    document.getElementById('stat-active').textContent = d.active ?? 0;
    const grades = d.by_grade || [];
    document.getElementById('stat-grades').textContent = grades.length;
    const majors = d.by_major || [];
    document.getElementById('stat-majors').textContent = majors.length;

    // Grade chart
    const maxG = Math.max(...grades.map(g => g.count), 1);
    document.getElementById('grade-chart').innerHTML = grades.length
      ? grades.map(g => `
          <div class="bar-row">
            <div class="bar-label">${g.grade}</div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${Math.round(g.count / maxG * 100)}%">
                <span class="bar-count">${g.count}</span>
              </div>
            </div>
          </div>`).join('')
      : '<div style="color:var(--c-muted);text-align:center;padding:20px">暂无数据</div>';

    // Major list
    document.getElementById('major-chart').innerHTML = majors.length
      ? majors.map((m, i) => `
          <div class="major-row">
            <div class="major-rank">${i + 1}</div>
            <div class="major-name">${m.major}</div>
            <div class="major-count">${m.count} 人</div>
          </div>`).join('')
      : '<div style="color:var(--c-muted);text-align:center;padding:20px">暂无数据</div>';
  } catch (e) {
    toast('统计加载失败: ' + e.message, 'error');
  }
}

/* ===== Student List & Search ===== */
function getSearchParams() {
  return {
    student_id: document.getElementById('s-student-id').value.trim(),
    name: document.getElementById('s-name').value.trim(),
    class: document.getElementById('s-class').value.trim(),
    major: document.getElementById('s-major').value.trim(),
    grade: document.getElementById('s-grade').value,
    status: document.getElementById('s-status').value,
  };
}

async function searchStudents(page) {
  if (page) state.currentPage = page;
  const params = getSearchParams();
  const qs = new URLSearchParams({
    ...params,
    page: state.currentPage,
    page_size: state.pageSize,
  });

  try {
    const data = await api('GET', '/students?' + qs);
    renderTable(data.students || []);
    state.totalPages = Math.ceil((data.total || 0) / state.pageSize);
    renderPagination(data.total || 0);
  } catch (e) {
    toast('搜索失败: ' + e.message, 'error');
  }
}

function clearSearch() {
  ['s-student-id', 's-name', 's-class', 's-major'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('s-grade').value = '';
  document.getElementById('s-status').value = '';
  state.currentPage = 1;
  searchStudents();
}

const statusMap = {
  active:    ['在读',   'active'],
  graduated: ['已毕业', 'graduated'],
  suspended: ['休学',   'suspended'],
  inactive:  ['注销',   'inactive'],
};

const genderMap = { male: '男', female: '女', other: '其他' };

function renderTable(students) {
  const tbody = document.getElementById('student-tbody');
  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty">未找到匹配的学生记录</td></tr>';
    return;
  }
  tbody.innerHTML = students.map(s => {
    const [statusLabel, statusCls] = statusMap[s.status] || ['未知', 'inactive'];
    return `<tr>
      <td><code style="font-size:12px">${s.student_id}</code></td>
      <td style="font-weight:600">${s.name}</td>
      <td>${genderMap[s.gender] || '—'}</td>
      <td>${s.grade}</td>
      <td>${s.class}</td>
      <td>${s.major}</td>
      <td>${s.phone || '—'}</td>
      <td><span class="status-badge status-${statusCls}">${statusLabel}</span></td>
      <td>
        <button class="btn-action btn-view" onclick="viewStudent('${s.student_id}')">详情</button>
        <button class="btn-action btn-edit" onclick="editStudent('${s.student_id}')">编辑</button>
        <button class="btn-action btn-del" onclick="confirmDelete('${s.student_id}','${s.name}')">删除</button>
      </td>
    </tr>`;
  }).join('');
}

function renderPagination(total) {
  const pg = document.getElementById('pagination');
  document.getElementById('result-count').textContent = `共 ${total} 条记录`;
  if (state.totalPages <= 1) { pg.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="searchStudents(${state.currentPage - 1})"
    ${state.currentPage <= 1 ? 'disabled' : ''}>‹</button>`;

  for (let i = 1; i <= state.totalPages; i++) {
    if (i === 1 || i === state.totalPages || Math.abs(i - state.currentPage) <= 2) {
      html += `<button class="page-btn${i === state.currentPage ? ' cur' : ''}" onclick="searchStudents(${i})">${i}</button>`;
    } else if (Math.abs(i - state.currentPage) === 3) {
      html += `<span style="padding:0 4px;color:var(--c-muted)">…</span>`;
    }
  }

  html += `<button class="page-btn" onclick="searchStudents(${state.currentPage + 1})"
    ${state.currentPage >= state.totalPages ? 'disabled' : ''}>›</button>`;
  pg.innerHTML = html;
}

/* ===== View Modal ===== */
async function viewStudent(sid) {
  try {
    const s = await api('GET', '/students/' + sid);
    state.currentStudentId = sid;
    const [statusLabel] = statusMap[s.status] || ['未知'];
    document.getElementById('modal-title').textContent = `学生详情 — ${s.name}`;
    document.getElementById('modal-body').innerHTML = `
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-key">学号</div><div class="detail-val"><code>${s.student_id}</code></div></div>
        <div class="detail-item"><div class="detail-key">姓名</div><div class="detail-val">${s.name}</div></div>
        <div class="detail-item"><div class="detail-key">性别</div><div class="detail-val">${genderMap[s.gender] || '—'}</div></div>
        <div class="detail-item"><div class="detail-key">出生日期</div><div class="detail-val">${s.birth_date || '—'}</div></div>
        <div class="detail-item"><div class="detail-key">年级</div><div class="detail-val">${s.grade}</div></div>
        <div class="detail-item"><div class="detail-key">班级</div><div class="detail-val">${s.class}</div></div>
        <div class="detail-item"><div class="detail-key">专业</div><div class="detail-val">${s.major}</div></div>
        <div class="detail-item"><div class="detail-key">学籍状态</div>
          <div class="detail-val"><span class="status-badge status-${s.status}">${statusLabel}</span></div></div>
        <div class="detail-item"><div class="detail-key">手机</div><div class="detail-val">${s.phone || '—'}</div></div>
        <div class="detail-item"><div class="detail-key">邮箱</div><div class="detail-val">${s.email || '—'}</div></div>
        <div class="detail-item span-2"><div class="detail-key">家庭住址</div><div class="detail-val">${s.address || '—'}</div></div>
        <div class="detail-item"><div class="detail-key">创建时间</div><div class="detail-val" style="font-size:12px;color:var(--c-muted)">${s.created_at}</div></div>
        <div class="detail-item"><div class="detail-key">更新时间</div><div class="detail-val" style="font-size:12px;color:var(--c-muted)">${s.updated_at}</div></div>
      </div>`;
    document.getElementById('modal-edit-btn').onclick = () => { closeModal(); editStudent(sid); };
    document.getElementById('modal-del-btn').onclick = () => { closeModal(); confirmDelete(sid, s.name); };
    document.getElementById('modal-overlay').classList.add('open');
  } catch (e) {
    toast('加载详情失败: ' + e.message, 'error');
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

/* ===== Form ===== */
function resetForm() {
  ['f-student-id','f-name','f-phone','f-email','f-address','f-birth-date'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-gender').value = 'male';
  document.getElementById('f-grade').value = '';
  document.getElementById('f-class').value = '';
  document.getElementById('f-major').value = '';
  document.getElementById('f-status').value = 'active';
  document.getElementById('edit-mode').value = 'add';
  document.getElementById('edit-sid').value = '';
  document.getElementById('f-student-id').disabled = false;
}

async function editStudent(sid) {
  try {
    const s = await api('GET', '/students/' + sid);
    document.getElementById('edit-mode').value = 'edit';
    document.getElementById('edit-sid').value = sid;
    document.getElementById('f-student-id').value = s.student_id;
    document.getElementById('f-student-id').disabled = true;
    document.getElementById('f-name').value = s.name;
    document.getElementById('f-gender').value = s.gender;
    document.getElementById('f-birth-date').value = s.birth_date || '';
    document.getElementById('f-grade').value = s.grade;
    document.getElementById('f-class').value = s.class;
    document.getElementById('f-major').value = s.major;
    document.getElementById('f-status').value = s.status;
    document.getElementById('f-phone').value = s.phone || '';
    document.getElementById('f-email').value = s.email || '';
    document.getElementById('f-address').value = s.address || '';
    document.getElementById('form-title').textContent = `编辑学生 — ${s.name}`;
    showPage('add');
  } catch (e) {
    toast('加载失败: ' + e.message, 'error');
  }
}

async function submitForm() {
  const sid = document.getElementById('f-student-id').value.trim();
  const name = document.getElementById('f-name').value.trim();
  const grade = document.getElementById('f-grade').value;
  const cls = document.getElementById('f-class').value.trim();
  const major = document.getElementById('f-major').value.trim();

  if (!sid || !name || !grade || !cls || !major) {
    toast('请填写所有必填项（学号、姓名、年级、班级、专业）', 'error');
    return;
  }

  const payload = {
    student_id: sid,
    name,
    grade,
    class: cls,
    major,
    gender: document.getElementById('f-gender').value,
    birth_date: document.getElementById('f-birth-date').value,
    status: document.getElementById('f-status').value,
    phone: document.getElementById('f-phone').value.trim(),
    email: document.getElementById('f-email').value.trim(),
    address: document.getElementById('f-address').value.trim(),
  };

  const isEdit = document.getElementById('edit-mode').value === 'edit';

  try {
    if (isEdit) {
      await api('PUT', '/students/' + sid, payload);
      toast('✅ 学生信息更新成功', 'success');
    } else {
      await api('POST', '/students', payload);
      toast('✅ 学生录入成功', 'success');
    }
    resetForm();
    showPage('list');
  } catch (e) {
    toast('操作失败: ' + e.message, 'error');
  }
}

/* ===== Delete ===== */
function confirmDelete(sid, name) {
  if (!confirm(`确认删除学生「${name}」（${sid}）？\n此操作不可撤销。`)) return;
  deleteStudent(sid);
}

async function deleteStudent(sid) {
  try {
    await api('DELETE', '/students/' + sid);
    toast('✅ 已删除学生 ' + sid, 'success');
    searchStudents();
  } catch (e) {
    toast('删除失败: ' + e.message, 'error');
  }
}

/* ===== Init ===== */
showPage('dashboard');
