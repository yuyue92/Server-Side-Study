(() => {
  'use strict';

  const state = {
    apiBase: 'http://localhost:8080/api/v1',
    departments: [],
    shiftTypes: [],
    staff: [],
    slots: [],
    workloads: [],
    pendingSwaps: [],
    emergencyCandidates: [],
    logs: [],
    selectedLogId: null,
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const els = {
    apiBaseInput: $('#apiBaseInput'),
    currentBaseBadge: $('#currentBaseBadge'),
    lastRequestBadge: $('#lastRequestBadge'),
    healthBadge: $('#healthBadge'),
    toastHost: $('#toastHost'),

    departmentsTbody: $('#departmentsTbody'),
    departmentCount: $('#departmentCount'),

    shiftTypesTbody: $('#shiftTypesTbody'),
    shiftTypeCount: $('#shiftTypeCount'),

    staffTbody: $('#staffTbody'),
    staffCount: $('#staffCount'),
    staffDetailResult: $('#staffDetailResult'),

    slotsTbody: $('#slotsTbody'),
    slotCount: $('#slotCount'),

    assignmentResult: $('#assignmentResult'),
    autoScheduleResult: $('#autoScheduleResult'),

    workloadTbody: $('#workloadTbody'),
    workloadCount: $('#workloadCount'),

    emergencyCandidateCount: $('#emergencyCandidateCount'),
    emergencyCandidatesThead: $('#emergencyCandidatesThead'),
    emergencyCandidatesTbody: $('#emergencyCandidatesTbody'),
    emergencyAssignResult: $('#emergencyAssignResult'),

    pendingSwapsTbody: $('#pendingSwapsTbody'),
    pendingSwapCount: $('#pendingSwapCount'),
    swapActionResult: $('#swapActionResult'),

    requestLogTbody: $('#requestLogTbody'),
    requestDetailBox: $('#requestDetailBox'),
  };

  async function init() {
    restoreBaseUrl();
    setDefaultDateRanges();
    bindEvents();
    renderAllSelects();
    renderRequestLogs();

    // 页面首次打开时自动加载基础数据，
    // 修复：工时报表 department_id 下拉为空、换班 slot_id 下拉未初始化的问题
    await bootstrapInitialData();
  }

    async function bootstrapInitialData() {
      // 1. 先加载科室、班次、员工
      // 科室加载后会同步填充 workloadDepartmentSelect 等所有 department 下拉
      await Promise.allSettled([
        loadDepartments(),
        loadShiftTypes(),
        loadStaff(),
      ]);

      // 2. 再根据“排班格查询区”的当前条件自动查询 slots
      // 查询成功后会同步填充 swapSlotSelect / assignmentSlotSelect
      await loadSlotsFromCurrentForm();
    }

  function bindEvents() {
    $('#saveBaseBtn').addEventListener('click', saveBaseUrl);
    $('#healthBtn').addEventListener('click', handleHealthCheck);
    $('#loadSeedBtn').addEventListener('click', async () => {
      await bootstrapInitialData();
      showToast('刷新完成', '已尝试刷新科室、班次、员工和当前排班格条件。', 'success');
    });

    $('#refreshDepartmentsBtn').addEventListener('click', loadDepartments);
    $('#refreshShiftTypesBtn').addEventListener('click', loadShiftTypes);
    $('#refreshStaffBtn').addEventListener('click', () => loadStaff());
    $('#refreshSlotsBtn').addEventListener('click', loadSlotsFromCurrentForm);
    $('#refreshWorkloadBtn').addEventListener('click', loadWorkloadFromCurrentForm);
    $('#refreshPendingSwapsBtn').addEventListener('click', loadPendingSwaps);
    $('#clearLogBtn').addEventListener('click', clearLogs);

    $('#departmentCreateForm').addEventListener('submit', handleCreateDepartment);
    $('#staffCreateForm').addEventListener('submit', handleCreateStaff);
    $('#staffQueryForm').addEventListener('submit', handleStaffQuery);
    $('#staffDetailForm').addEventListener('submit', handleStaffDetail);
    $('#slotCreateForm').addEventListener('submit', handleCreateSlot);
    $('#slotQueryForm').addEventListener('submit', handleSlotQuery);
    $('#assignmentCreateForm').addEventListener('submit', handleCreateAssignment);
    $('#assignmentDeleteForm').addEventListener('submit', handleDeleteAssignment);
    $('#autoScheduleForm').addEventListener('submit', handleAutoSchedule);
    $('#workloadQueryForm').addEventListener('submit', handleWorkloadQuery);
    $('#emergencyCandidatesForm').addEventListener('submit', handleEmergencyCandidates);
    $('#emergencyAssignForm').addEventListener('submit', handleEmergencyAssign);
    $('#swapCreateForm').addEventListener('submit', handleCreateSwap);
    $('#swapReviewForm').addEventListener('submit', handleReviewSwap);
  }

  function restoreBaseUrl() {
    const cached = localStorage.getItem('hospitalScheduler.apiBase');
    state.apiBase = sanitizeBaseUrl(cached || state.apiBase);
    els.apiBaseInput.value = state.apiBase;
    els.currentBaseBadge.textContent = state.apiBase;
  }

  function sanitizeBaseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  function saveBaseUrl() {
    const next = sanitizeBaseUrl(els.apiBaseInput.value);
    if (!next) {
      showToast('保存失败', 'API Base URL 不能为空。', 'error');
      return;
    }
    state.apiBase = next;
    localStorage.setItem('hospitalScheduler.apiBase', next);
    els.currentBaseBadge.textContent = next;
    showToast('保存成功', `当前接口地址已切换为 ${next}`, 'success');
  }

  function rootBaseUrl() {
    return state.apiBase.replace(/\/api\/v1$/i, '');
  }

  function pathUrl(path, useRoot = false) {
    const prefix = useRoot ? rootBaseUrl() : state.apiBase;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${prefix}${normalized}`;
  }

  async function apiRequest({ method = 'GET', path, body, useRoot = false, label = '' }) {
    const url = pathUrl(path, useRoot);
    const startedAt = performance.now();
    const startIso = new Date().toISOString();
    const init = {
      method,
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    };

    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    let response;
    let parsed;
    let rawText = '';
    let fetchError = null;

    try {
      response = await fetch(url, init);
      rawText = await response.text();
      parsed = safeJsonParse(rawText);
      if (parsed === undefined) {
        parsed = rawText;
      }
    } catch (error) {
      fetchError = error;
      parsed = {
        error: 'NETWORK_ERROR',
        message: error?.message || String(error),
      };
    }

    const duration = Math.round(performance.now() - startedAt);
    const logItem = {
      id: createId(),
      at: startIso,
      label,
      method,
      path,
      url,
      requestBody: body,
      status: response?.status ?? 0,
      ok: response?.ok ?? false,
      duration,
      responseBody: parsed,
      rawText,
      error: fetchError ? String(fetchError) : '',
    };

    addLog(logItem);
    els.lastRequestBadge.textContent = `${method} ${path}`;

    if (fetchError) {
      throw Object.assign(new Error(fetchError.message || '网络请求失败'), { logItem });
    }

    if (!response.ok) {
      const message = extractErrorMessage(parsed) || `HTTP ${response.status}`;
      const error = new Error(message);
      error.logItem = logItem;
      error.payload = parsed;
      throw error;
    }

    return {
      data: parsed,
      response,
      logItem,
    };
  }

  function safeJsonParse(text) {
    if (text === '') return null;
    try {
      return JSON.parse(text);
    } catch (_) {
      return undefined;
    }
  }

  function extractErrorMessage(payload) {
    if (!payload || typeof payload !== 'object') return '';
    return payload.message || payload.error || payload.detail || payload.msg || '';
  }

  function unwrapPayload(payload) {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      if (payload.data !== undefined) return payload.data;
      if (payload.items !== undefined) return payload.items;
      if (payload.result !== undefined) return payload.result;
      if (payload.rows !== undefined) return payload.rows;
    }
    return payload;
  }

  function asArray(payload) {
    const unwrapped = unwrapPayload(payload);
    if (Array.isArray(unwrapped)) return unwrapped;
    if (unwrapped === null || unwrapped === undefined || unwrapped === '') return [];
    return [unwrapped];
  }

  function createId() {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function showToast(title, message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(message)}</p>
    `;
    els.toastHost.appendChild(toast);
    window.setTimeout(() => {
      toast.remove();
    }, 4200);
  }

  function pretty(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
  }

  function writeJson(el, value) {
    el.textContent = pretty(value);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function td(value, className = '') {
    return `<td class="${escapeHtml(className)}">${value}</td>`;
  }

  function badgeBoolean(value) {
    const normalized = Number(value) === 1 || value === true || value === 'true';
    return `<span class="pill ${normalized ? 'success' : 'neutral'}">${normalized ? '是' : '否'}</span>`;
  }

  function statusPill(value) {
    const text = String(value ?? '-');
    const upper = text.toUpperCase();
    let type = 'neutral';
    if (['OPEN', 'ACTIVE', 'APPROVED', 'FILLED'].includes(upper)) type = 'success';
    if (['PENDING', 'LOCKED'].includes(upper)) type = 'warning';
    if (['CANCELED', 'REJECTED'].includes(upper)) type = 'danger';
    return `<span class="pill ${type}">${escapeHtml(text)}</span>`;
  }

  function tags(values) {
    const arr = normalizeList(values);
    if (!arr.length) return '<span class="muted">-</span>';
    return `<div class="tag-list">${arr.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('')}</div>`;
  }

  function normalizeList(value) {
    if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined && item !== '');
    if (typeof value === 'string') {
      if (!value.trim()) return [];
      if (value.trim().startsWith('[')) {
        const parsed = safeJsonParse(value);
        if (Array.isArray(parsed)) return parsed;
      }
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
  }

  function parseCsvInput(value) {
    return normalizeList(value);
  }

  function pick(obj, ...keys) {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return '';
  }

  function formatDateTime(value) {
    if (!value) return '<span class="muted">-</span>';
    return escapeHtml(String(value));
  }

  function departmentLabel(id) {
    const dept = state.departments.find((item) => Number(item.id) === Number(id));
    if (!dept) return id ? `#${escapeHtml(id)}` : '-';
    return `${escapeHtml(dept.name || '-')}${dept.code ? ` <span class="muted mono">(${escapeHtml(dept.code)})</span>` : ''}`;
  }

  function shiftTypeLabel(id) {
    const shift = state.shiftTypes.find((item) => Number(item.id) === Number(id));
    if (!shift) return id ? `#${escapeHtml(id)}` : '-';
    return `${escapeHtml(shift.name || shift.code || '-')}${shift.code ? ` <span class="muted mono">(${escapeHtml(shift.code)})</span>` : ''}`;
  }

  function staffLabel(item) {
    return `${item.name || '-'}${item.employee_no ? ` / ${item.employee_no}` : ''} / ID:${item.id}`;
  }

  function slotLabel(item) {
    const date = item.date || '-';
    const dept = item.department_id ? `Dept:${item.department_id}` : 'Dept:-';
    const shift = item.shift_type_id ? `Shift:${item.shift_type_id}` : 'Shift:-';
    return `${date} / ${dept} / ${shift} / ID:${item.id}`;
  }

  function fillSelect(select, options, { placeholder = '请选择', allowBlank = false } = {}) {
    const previous = select.value;
    const html = [];

    if (!select) {
      return;
    }
    if (allowBlank) {
      html.push(`<option value="">${escapeHtml(placeholder)}</option>`);
    }
    for (const option of options) {
      html.push(`<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`);
    }
    select.innerHTML = html.join('');

    // 没有数据时，显式展示占位提示，避免下拉框“纯空白”
    if (!options.length && !allowBlank) {
      select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;
    }

    if ([...select.options].some((option) => option.value === previous)) {
      select.value = previous;
    }
  }

  function renderAllSelects() {
    const deptOptions = state.departments.map((item) => ({
      value: item.id,
      label: `${item.name || '-'} / ${item.code || '-'} / ID:${item.id}`,
    }));

    const staffOptions = state.staff.map((item) => ({
      value: item.id,
      label: staffLabel(item),
    }));

    const shiftOptions = state.shiftTypes.map((item) => ({
      value: item.id,
      label: `${item.name || '-'} / ${item.code || '-'} / ID:${item.id}`,
    }));

    const slotOptions = state.slots.map((item) => ({
      value: item.id,
      label: slotLabel(item),
    }));

    fillSelect($('#staffDepartmentSelect'), deptOptions, { placeholder: '暂无科室' });
    fillSelect($('#staffQueryDepartmentSelect'), deptOptions, { placeholder: '全部科室', allowBlank: true });
    fillSelect($('#slotDepartmentSelect'), deptOptions, { placeholder: '暂无科室' });
    fillSelect($('#slotQueryDepartmentSelect'), deptOptions, { placeholder: '暂无科室' });
    fillSelect($('#autoDepartmentSelect'), deptOptions, { placeholder: '暂无科室' });
    fillSelect($('#workloadDepartmentSelect'), deptOptions, { placeholder: '暂无科室' });

    fillSelect($('#slotShiftTypeSelect'), shiftOptions, { placeholder: '暂无班次' });

    fillSelect($('#assignmentStaffSelect'), staffOptions, { placeholder: '暂无员工' });
    fillSelect($('#swapRequesterSelect'), staffOptions, { placeholder: '暂无员工' });
    fillSelect($('#swapTargetStaffSelect'), staffOptions, { placeholder: '可为空', allowBlank: true });
    fillSelect($('#swapReviewerSelect'), staffOptions, { placeholder: '暂无员工' });

    fillSelect($('#assignmentSlotSelect'), slotOptions, { placeholder: '暂无排班格' });
    fillSelect($('#swapSlotSelect'), slotOptions, { placeholder: '暂无排班格' });
  }

  function setDefaultDateRanges() {
    const today = new Date();
    const todayString = toDateInputValue(today);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const nextWeekString = toDateInputValue(nextWeek);

    const slotQueryForm = $('#slotQueryForm');
    slotQueryForm.elements.from.value = todayString;
    slotQueryForm.elements.to.value = nextWeekString;

    const autoForm = $('#autoScheduleForm');
    autoForm.elements.from.value = todayString;
    autoForm.elements.to.value = nextWeekString;

    const slotCreateForm = $('#slotCreateForm');
    slotCreateForm.elements.date.value = todayString;
  }

  function toDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async function handleHealthCheck() {
    els.healthBadge.textContent = '检查中';
    els.healthBadge.className = 'pill warning';
    try {
      const result = await apiRequest({ method: 'GET', path: '/health', useRoot: true, label: '健康检查' });
      els.healthBadge.textContent = '正常';
      els.healthBadge.className = 'pill success';
      showToast('健康检查通过', pretty(result.data), 'success');
    } catch (error) {
      els.healthBadge.textContent = '异常';
      els.healthBadge.className = 'pill danger';
      showToast('健康检查失败', error.message, 'error');
    }
  }

  async function handleCreateDepartment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = {
      name: form.elements.name.value.trim(),
      code: form.elements.code.value.trim(),
    };
    try {
      await apiRequest({ method: 'POST', path: '/departments', body, label: '创建科室' });
      form.reset();
      showToast('创建科室成功', `${body.name} / ${body.code}`, 'success');
      await loadDepartments();
    } catch (error) {
      showToast('创建科室失败', error.message, 'error');
    }
  }

  async function loadDepartments() {
    try {
      const { data } = await apiRequest({ method: 'GET', path: '/departments', label: '获取科室列表' });
      state.departments = asArray(data);
      renderDepartments();
      renderAllSelects();
      return state.departments;
    } catch (error) {
      showToast('获取科室失败', error.message, 'error');
      return [];
    }
  }

  function renderDepartments() {
    els.departmentCount.textContent = String(state.departments.length);
    if (!state.departments.length) {
      els.departmentsTbody.innerHTML = '<tr><td colspan="5" class="muted">暂无数据</td></tr>';
      return;
    }
    els.departmentsTbody.innerHTML = state.departments.map((item) => `
      <tr>
        ${td(escapeHtml(item.id ?? '-'), 'mono')}
        ${td(escapeHtml(item.name ?? '-'))}
        ${td(`<span class="inline-code">${escapeHtml(item.code ?? '-')}</span>`) }
        ${td(badgeBoolean(item.is_active ?? 1))}
        ${td(formatDateTime(item.created_at))}
      </tr>
    `).join('');
  }

  async function loadShiftTypes() {
    try {
      const { data } = await apiRequest({ method: 'GET', path: '/shift-types', label: '获取班次类型' });
      state.shiftTypes = asArray(data);
      renderShiftTypes();
      renderAllSelects();
      return state.shiftTypes;
    } catch (error) {
      showToast('获取班次类型失败', error.message, 'error');
      return [];
    }
  }

  function renderShiftTypes() {
    els.shiftTypeCount.textContent = String(state.shiftTypes.length);
    if (!state.shiftTypes.length) {
      els.shiftTypesTbody.innerHTML = '<tr><td colspan="6" class="muted">暂无数据</td></tr>';
      return;
    }
    els.shiftTypesTbody.innerHTML = state.shiftTypes.map((item) => {
      const start = formatClock(item.start_hour, item.start_minute);
      const end = formatClock(item.end_hour, item.end_minute);
      return `
        <tr>
          ${td(escapeHtml(item.id ?? '-'), 'mono')}
          ${td(`<span class="inline-code">${escapeHtml(item.code ?? '-')}</span>`) }
          ${td(escapeHtml(item.name ?? '-'))}
          ${td(escapeHtml(start), 'mono')}
          ${td(escapeHtml(end), 'mono')}
          ${td(formatDateTime(item.created_at))}
        </tr>
      `;
    }).join('');
  }

  function formatClock(hour, minute) {
    if (hour === undefined || hour === null || hour === '') return '-';
    return `${String(hour).padStart(2, '0')}:${String(minute ?? 0).padStart(2, '0')}`;
  }

  async function handleCreateStaff(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = {
      employee_no: form.elements.employee_no.value.trim(),
      name: form.elements.name.value.trim(),
      role: form.elements.role.value,
      department_id: Number(form.elements.department_id.value),
      qualifications: parseCsvInput(form.elements.qualifications.value),
    };
    try {
      await apiRequest({ method: 'POST', path: '/staff', body, label: '创建员工' });
      form.reset();
      renderAllSelects();
      showToast('创建员工成功', `${body.employee_no} / ${body.name}`, 'success');
      await loadStaff();
    } catch (error) {
      showToast('创建员工失败', error.message, 'error');
    }
  }

  async function handleStaffQuery(event) {
    event.preventDefault();
    const departmentId = event.currentTarget.elements.department_id.value;
    await loadStaff(departmentId);
  }

  async function loadStaff(departmentId = '') {
    try {
      const query = departmentId ? `?department_id=${encodeURIComponent(departmentId)}` : '';
      const { data } = await apiRequest({ method: 'GET', path: `/staff${query}`, label: '获取员工列表' });
      state.staff = asArray(data);
      renderStaff();
      renderAllSelects();
      return state.staff;
    } catch (error) {
      showToast('获取员工失败', error.message, 'error');
      return [];
    }
  }

  async function handleStaffDetail(event) {
    event.preventDefault();
    const staffId = event.currentTarget.elements.staff_id.value;
    try {
      const { data } = await apiRequest({ method: 'GET', path: `/staff/${encodeURIComponent(staffId)}`, label: '获取员工详情' });
      writeJson(els.staffDetailResult, data);
      showToast('获取员工详情成功', `staff_id=${staffId}`, 'success');
    } catch (error) {
      writeJson(els.staffDetailResult, error.payload || { error: error.message });
      showToast('获取员工详情失败', error.message, 'error');
    }
  }

  function renderStaff() {
    els.staffCount.textContent = String(state.staff.length);
    if (!state.staff.length) {
      els.staffTbody.innerHTML = '<tr><td colspan="8" class="muted">暂无数据</td></tr>';
      return;
    }
    els.staffTbody.innerHTML = state.staff.map((item) => `
      <tr>
        ${td(escapeHtml(item.id ?? '-'), 'mono')}
        ${td(`<span class="inline-code">${escapeHtml(item.employee_no ?? '-')}</span>`) }
        ${td(escapeHtml(item.name ?? '-'))}
        ${td(statusPill(item.role ?? '-'))}
        ${td(departmentLabel(item.department_id))}
        ${td(tags(pick(item, 'qualifications', 'staff_qualifications', 'quals')))}
        ${td(badgeBoolean(item.is_active ?? 1))}
        ${td(formatDateTime(item.created_at))}
      </tr>
    `).join('');
  }

  async function handleCreateSlot(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = {
      department_id: Number(form.elements.department_id.value),
      shift_type_id: Number(form.elements.shift_type_id.value),
      date: form.elements.date.value,
      required_staff: Number(form.elements.required_staff.value),
      required_role: form.elements.required_role.value,
      required_quals: parseCsvInput(form.elements.required_quals.value),
    };
    try {
      await apiRequest({ method: 'POST', path: '/slots', body, label: '创建排班格' });
      showToast('创建排班格成功', `${body.date} / dept:${body.department_id} / shift:${body.shift_type_id}`, 'success');
      await loadSlotsFromCurrentForm();
    } catch (error) {
      showToast('创建排班格失败', error.message, 'error');
    }
  }

  async function handleSlotQuery(event) {
    event.preventDefault();
    await loadSlotsFromForm(event.currentTarget);
  }

  async function loadSlotsFromCurrentForm() {
    return loadSlotsFromForm($('#slotQueryForm'));
  }

  async function loadSlotsFromForm(form) {
    const departmentId = form.elements.department_id.value;
    const from = form.elements.from.value;
    const to = form.elements.to.value;
    if (!departmentId || !from || !to) {
      renderSlots();
      return [];
    }
    try {
      const params = new URLSearchParams({ department_id: departmentId, from, to });
      const { data } = await apiRequest({ method: 'GET', path: `/slots?${params.toString()}`, label: '查询排班格' });
      state.slots = asArray(data);
      renderSlots();
      renderAllSelects();
      return state.slots;
    } catch (error) {
      showToast('查询排班格失败', error.message, 'error');
      return [];
    }
  }

  function renderSlots() {
    els.slotCount.textContent = String(state.slots.length);
    if (!state.slots.length) {
      els.slotsTbody.innerHTML = '<tr><td colspan="10" class="muted">暂无数据</td></tr>';
      return;
    }
    els.slotsTbody.innerHTML = state.slots.map((item) => `
      <tr>
        ${td(escapeHtml(item.id ?? '-'), 'mono')}
        ${td(escapeHtml(item.date ?? '-'), 'mono')}
        ${td(departmentLabel(item.department_id))}
        ${td(shiftTypeLabel(item.shift_type_id))}
        ${td(escapeHtml(item.required_staff ?? '-'), 'mono')}
        ${td(escapeHtml(item.assigned_count ?? 0), 'mono')}
        ${td(statusPill(item.required_role || '不限'))}
        ${td(tags(pick(item, 'required_quals', 'qualifications', 'slot_qualifications')))}
        ${td(statusPill(item.status ?? '-'))}
        ${td(formatDateTime(item.created_at))}
      </tr>
    `).join('');
  }

  async function handleCreateAssignment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = {
      staff_id: Number(form.elements.staff_id.value),
      slot_id: Number(form.elements.slot_id.value),
      created_by: Number(form.elements.created_by.value),
    };
    try {
      const { data } = await apiRequest({ method: 'POST', path: '/assignments', body, label: '手动排班' });
      writeJson(els.assignmentResult, data);
      showToast('手动排班请求成功', `staff:${body.staff_id} -> slot:${body.slot_id}`, 'success');
      await loadSlotsFromCurrentForm();
    } catch (error) {
      writeJson(els.assignmentResult, error.payload || { error: error.message });
      showToast('手动排班失败', error.message, 'error');
    }
  }

  async function handleDeleteAssignment(event) {
    event.preventDefault();
    const assignmentId = event.currentTarget.elements.assignment_id.value;
    try {
      const { data } = await apiRequest({ method: 'DELETE', path: `/assignments/${encodeURIComponent(assignmentId)}`, label: '取消排班' });
      writeJson(els.assignmentResult, data);
      showToast('取消排班成功', `assignment_id=${assignmentId}`, 'success');
      await loadSlotsFromCurrentForm();
    } catch (error) {
      writeJson(els.assignmentResult, error.payload || { error: error.message });
      showToast('取消排班失败', error.message, 'error');
    }
  }

  async function handleAutoSchedule(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = {
      department_id: Number(form.elements.department_id.value),
      from: form.elements.from.value,
      to: form.elements.to.value,
    };
    try {
      const { data } = await apiRequest({ method: 'POST', path: '/schedule/auto', body, label: '自动排班' });
      writeJson(els.autoScheduleResult, data);
      showToast('自动排班完成', `${body.from} ~ ${body.to}`, 'success');
      await loadSlotsFromCurrentForm();
    } catch (error) {
      writeJson(els.autoScheduleResult, error.payload || { error: error.message });
      showToast('自动排班失败', error.message, 'error');
    }
  }

  async function handleWorkloadQuery(event) {
    event.preventDefault();
    await loadWorkloadFromForm(event.currentTarget);
  }

  async function loadWorkloadFromCurrentForm() {
    return loadWorkloadFromForm($('#workloadQueryForm'));
  }

  async function loadWorkloadFromForm(form) {
    const departmentId = form.elements.department_id.value;
    if (!departmentId) {
      renderWorkload();
      return [];
    }
    try {
      const { data } = await apiRequest({ method: 'GET', path: `/workload?department_id=${encodeURIComponent(departmentId)}`, label: '获取工时报表' });
      state.workloads = asArray(data);
      renderWorkload();
      return state.workloads;
    } catch (error) {
      showToast('获取工时报表失败', error.message, 'error');
      return [];
    }
  }

  function renderWorkload() {
    els.workloadCount.textContent = String(state.workloads.length);
    if (!state.workloads.length) {
      els.workloadTbody.innerHTML = '<tr><td colspan="9" class="muted">暂无数据</td></tr>';
      return;
    }
    els.workloadTbody.innerHTML = state.workloads.map((item) => {
      const extra = { ...item };
      ['staff_id', 'total_hours', 'month_hours', 'week_hours', 'consecutive_shifts', 'last_shift_end', 'night_shifts_this_month', 'updated_at'].forEach((key) => delete extra[key]);
      return `
        <tr>
          ${td(escapeHtml(item.staff_id ?? '-'), 'mono')}
          ${td(escapeHtml(item.total_hours ?? '-'), 'mono')}
          ${td(escapeHtml(item.month_hours ?? '-'), 'mono')}
          ${td(escapeHtml(item.week_hours ?? '-'), 'mono')}
          ${td(escapeHtml(item.consecutive_shifts ?? '-'), 'mono')}
          ${td(formatDateTime(item.last_shift_end))}
          ${td(escapeHtml(item.night_shifts_this_month ?? '-'), 'mono')}
          ${td(formatDateTime(item.updated_at))}
          ${td(`<span class="mono">${escapeHtml(Object.keys(extra).length ? pretty(extra) : '-')}</span>`) }
        </tr>
      `;
    }).join('');
  }

  async function handleEmergencyCandidates(event) {
    event.preventDefault();
    const slotId = event.currentTarget.elements.slot_id.value;
    try {
      const { data } = await apiRequest({ method: 'GET', path: `/emergency/candidates/${encodeURIComponent(slotId)}`, label: '查询应急候选人' });
      state.emergencyCandidates = asArray(data);
      renderEmergencyCandidates();
      showToast('查询应急候选人成功', `slot_id=${slotId}`, 'success');
    } catch (error) {
      state.emergencyCandidates = [];
      renderEmergencyCandidates();
      showToast('查询应急候选人失败', error.message, 'error');
    }
  }

  function renderEmergencyCandidates() {
    els.emergencyCandidateCount.textContent = String(state.emergencyCandidates.length);
    renderFlexibleTable({
      records: state.emergencyCandidates,
      thead: els.emergencyCandidatesThead,
      tbody: els.emergencyCandidatesTbody,
      emptyText: '暂无应急候选人数据',
    });
  }

  async function handleEmergencyAssign(event) {
    event.preventDefault();
    const payloadText = event.currentTarget.elements.payload.value.trim();
    const payload = safeJsonParse(payloadText);
    if (payload === undefined || payload === null || Array.isArray(payload) || typeof payload !== 'object') {
      showToast('请求体格式错误', '请填写合法 JSON 对象。', 'error');
      return;
    }
    try {
      const { data } = await apiRequest({ method: 'POST', path: '/emergency/assign', body: payload, label: '应急分配' });
      writeJson(els.emergencyAssignResult, data);
      showToast('应急分配请求成功', '接口已返回成功响应。', 'success');
      await loadSlotsFromCurrentForm();
    } catch (error) {
      writeJson(els.emergencyAssignResult, error.payload || { error: error.message });
      showToast('应急分配失败', error.message, 'error');
    }
  }

  async function handleCreateSwap(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const targetStaffId = form.elements.target_staff_id.value;
    const body = {
      requester_id: Number(form.elements.requester_id.value),
      slot_id: Number(form.elements.slot_id.value),
      reason: form.elements.reason.value.trim(),
    };
    if (targetStaffId) {
      body.target_staff_id = Number(targetStaffId);
    }
    try {
      const { data } = await apiRequest({ method: 'POST', path: '/swaps', body, label: '提交换班申请' });
      writeJson(els.swapActionResult, data);
      showToast('提交换班申请成功', `requester_id=${body.requester_id}`, 'success');
      await loadPendingSwaps();
    } catch (error) {
      writeJson(els.swapActionResult, error.payload || { error: error.message });
      showToast('提交换班申请失败', error.message, 'error');
    }
  }

  async function handleReviewSwap(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const swapId = form.elements.swap_id.value;
    const body = {
      action: form.elements.action.value,
      reviewer_id: Number(form.elements.reviewer_id.value),
      note: form.elements.note.value.trim(),
    };
    try {
      const { data } = await apiRequest({ method: 'POST', path: `/swaps/${encodeURIComponent(swapId)}/review`, body, label: '审批换班申请' });
      writeJson(els.swapActionResult, data);
      showToast('审批请求成功', `swap_id=${swapId} / ${body.action}`, 'success');
      await loadPendingSwaps();
    } catch (error) {
      writeJson(els.swapActionResult, error.payload || { error: error.message });
      showToast('审批换班失败', error.message, 'error');
    }
  }

  async function loadPendingSwaps() {
    try {
      const { data } = await apiRequest({ method: 'GET', path: '/swaps/pending', label: '获取待审换班列表' });
      state.pendingSwaps = asArray(data);
      renderPendingSwaps();
      return state.pendingSwaps;
    } catch (error) {
      showToast('获取待审换班失败', error.message, 'error');
      return [];
    }
  }

  function renderPendingSwaps() {
    els.pendingSwapCount.textContent = String(state.pendingSwaps.length);
    if (!state.pendingSwaps.length) {
      els.pendingSwapsTbody.innerHTML = '<tr><td colspan="10" class="muted">暂无待审核换班申请</td></tr>';
      return;
    }
    els.pendingSwapsTbody.innerHTML = state.pendingSwaps.map((item) => `
      <tr>
        ${td(escapeHtml(item.id ?? '-'), 'mono')}
        ${td(escapeHtml(item.requester_id ?? '-'), 'mono')}
        ${td(escapeHtml(pick(item, 'requester_slot_id', 'slot_id') || '-'), 'mono')}
        ${td(escapeHtml(item.target_staff_id ?? '-'), 'mono')}
        ${td(escapeHtml(item.reason ?? '-'))}
        ${td(statusPill(item.status ?? '-'))}
        ${td(escapeHtml(pick(item, 'review_note', 'note') || '-'))}
        ${td(escapeHtml(pick(item, 'reviewed_by', 'reviewer_id') || '-'), 'mono')}
        ${td(formatDateTime(item.created_at))}
        ${td(formatDateTime(item.updated_at))}
      </tr>
    `).join('');
  }

  function renderFlexibleTable({ records, thead, tbody, emptyText }) {
    if (!records.length) {
      thead.innerHTML = '<tr><th>结果</th></tr>';
      tbody.innerHTML = `<tr><td class="muted">${escapeHtml(emptyText)}</td></tr>`;
      return;
    }
    const keySet = new Set();
    records.forEach((record) => {
      if (record && typeof record === 'object' && !Array.isArray(record)) {
        Object.keys(record).forEach((key) => keySet.add(key));
      }
    });
    const keys = keySet.size ? Array.from(keySet) : ['value'];
    thead.innerHTML = `<tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join('')}</tr>`;
    tbody.innerHTML = records.map((record) => {
      const row = (record && typeof record === 'object' && !Array.isArray(record)) ? record : { value: record };
      return `<tr>${keys.map((key) => {
        const value = row[key];
        const rendered = value && typeof value === 'object' ? pretty(value) : String(value ?? '-');
        return `<td><span class="mono">${escapeHtml(rendered)}</span></td>`;
      }).join('')}</tr>`;
    }).join('');
  }

  function addLog(logItem) {
    state.logs.unshift(logItem);
    state.logs = state.logs.slice(0, 80);
    state.selectedLogId = logItem.id;
    renderRequestLogs();
    renderRequestDetail(logItem);
  }

  function clearLogs() {
    state.logs = [];
    state.selectedLogId = null;
    renderRequestLogs();
    els.requestDetailBox.textContent = '点击左侧请求日志查看详情。';
    showToast('已清空日志', '当前页面内的请求日志已清除。', 'success');
  }

  function renderRequestLogs() {
    if (!state.logs.length) {
      els.requestLogTbody.innerHTML = '<tr><td colspan="5" class="muted">暂无请求日志</td></tr>';
      return;
    }
    els.requestLogTbody.innerHTML = state.logs.map((item) => `
      <tr class="log-row ${item.id === state.selectedLogId ? 'active' : ''}" data-log-id="${escapeHtml(item.id)}">
        ${td(escapeHtml(formatLogTime(item.at)), 'mono')}
        ${td(`<span class="inline-code">${escapeHtml(item.method)}</span>`) }
        ${td(escapeHtml(item.path), 'mono')}
        ${td(item.ok ? `<span class="pill success">${escapeHtml(item.status)}</span>` : `<span class="pill danger">${escapeHtml(item.status || 'ERR')}</span>`) }
        ${td(`${escapeHtml(item.duration)} ms`, 'mono')}
      </tr>
    `).join('');
    $$('.log-row').forEach((row) => {
      row.addEventListener('click', () => {
        const logId = row.dataset.logId;
        const item = state.logs.find((log) => log.id === logId);
        if (!item) return;
        state.selectedLogId = logId;
        renderRequestLogs();
        renderRequestDetail(item);
      });
    });
  }

  function formatLogTime(iso) {
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString('zh-CN', { hour12: false });
    } catch (_) {
      return iso;
    }
  }

  function renderRequestDetail(item) {
    writeJson(els.requestDetailBox, {
      label: item.label,
      at: item.at,
      method: item.method,
      path: item.path,
      url: item.url,
      status: item.status,
      ok: item.ok,
      duration_ms: item.duration,
      request_body: item.requestBody ?? null,
      response_body: item.responseBody ?? null,
      error: item.error || null,
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
