<template>
  <div class="app-root">
    <!-- ════════════════════════════════════════
         TITLE BAR
    ════════════════════════════════════════ -->
    <header class="title-bar" data-tauri-drag-region>
      <div class="title-bar-left">
        <span class="app-logo">⬡</span>
        <span class="app-name">MODBUS RTU 控制上位机</span>
        <span v-if="configFileName" class="config-name">
          <span class="sep">·</span>{{ configFileName }}
        </span>
      </div>
      <div class="title-bar-right">
        <div v-if="config.sheets.length" class="modbus-status-mini">
          <span class="dot" :class="isConnected ? 'on' : 'off'"></span>
          <span class="mono" style="font-size:10px">{{ isConnected ? 'CONNECTED' : 'OFFLINE' }}</span>
        </div>
      </div>
    </header>

    <!-- ════════════════════════════════════════
         SERIAL PORT PANEL
    ════════════════════════════════════════ -->
    <SerialPortPanel
      :is-connected="isConnected"
      :is-polling="isPolling"
      :connection-error="connectionError ? connectionError.toString() : null"
      :stats="stats"
      @connect="handleConnect"
      @disconnect="handleDisconnect"
      @toggle-polling="handleTogglePolling"
    />

    <!-- ════════════════════════════════════════
         MAIN CONTENT
    ════════════════════════════════════════ -->
    <main class="main-content">

      <!-- No config loaded -->
      <div v-if="!config.sheets.length" class="landing">
        <div class="landing-card">
          <div class="landing-icon">⬡</div>
          <h1 class="landing-title">Modbus RTU 上位机</h1>
          <p class="landing-desc">加载 Excel 配置文件（.xlsx）以渲染控制界面</p>

          <div class="landing-actions">
            <label class="btn-load" for="file-input">
              <span class="btn-icon">📂</span>
              选择配置文件
            </label>
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              style="display:none"
              @change="handleFileSelect"
            />
            <button class="btn-sample" @click="loadSampleConfig">
              <span class="btn-icon">⚡</span>
              加载示例配置
            </button>
          </div>

          <div class="landing-hint">
            <div class="hint-item">每个 Sheet 对应一个标签页</div>
            <div class="hint-item">每行一个控制条目（name / 寄存器地址 / 读写权限 / 组件类型 …）</div>
            <div class="hint-item">界面为 N行 × 4列 网格自动排列</div>
          </div>
        </div>
      </div>

      <!-- Config loaded: Tabs + Sheet grids -->
      <template v-else>
        <!-- Tab bar -->
        <nav class="tab-bar">
          <div
            v-for="(sheet, idx) in config.sheets"
            :key="sheet.name"
            class="tab-item"
            :class="{ active: activeTab === idx }"
            @click="activeTab = idx"
          >
            <span class="tab-name">{{ sheet.name }}</span>
            <span class="tab-count">{{ sheet.items.length }}</span>
          </div>
          <!-- Reload config button -->
          <div class="tab-spacer"></div>
          <label class="tab-action" for="reload-input" title="重新加载配置文件">
            <span>↺</span> 重载配置
          </label>
          <input
            id="reload-input"
            type="file"
            accept=".xlsx,.xls"
            style="display:none"
            @change="handleFileSelect"
          />
        </nav>

        <!-- Sheet content -->
        <div class="sheet-container">
          <TransitionGroup name="tab-fade">
            <SheetTab
              v-for="(sheet, idx) in config.sheets"
              v-show="activeTab === idx"
              :key="sheet.name"
              :items="sheet.items"
              @write="handleWrite"
            />
          </TransitionGroup>
        </div>
      </template>
    </main>

    <!-- ════════════════════════════════════════
         STATUS BAR
    ════════════════════════════════════════ -->
    <footer class="status-bar">
      <div class="status-left">
        <span v-if="lastWriteMsg" class="status-msg write-msg">
          <span class="msg-dot"></span>{{ lastWriteMsg }}
        </span>
        <span v-else class="status-msg muted">就绪</span>
      </div>
      <div class="status-right">
        <span v-if="config.sheets.length" class="status-info">
          {{ totalItems }} 条目 · {{ config.sheets.length }} 页签
        </span>
        <span class="status-version mono">v0.1.0</span>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onUnmounted } from 'vue'
import SerialPortPanel from './components/SerialPortPanel.vue'
import SheetTab from './components/SheetTab.vue'
import { parseConfigFile, generateSampleConfig } from './utils/excelParser.js'
import { useModbus } from './composables/useModbus.js'

// ─── State ────────────────────────────────────────────────
const config = reactive({ sheets: [] })
const configFileName = ref('')
const activeTab = ref(0)
const lastWriteMsg = ref('')
let writeTimer = null

// ─── Modbus ───────────────────────────────────────────────
const {
  isConnected,
  isPolling,
  connectionError,
  portConfig,
  stats,
  connect,
  disconnect,
  writeRegister,
  startPolling,
  stopPolling,
} = useModbus()

// ─── Computed ─────────────────────────────────────────────
const totalItems = computed(() =>
  config.sheets.reduce((sum, s) => sum + s.items.length, 0)
)

const allItems = computed(() =>
  config.sheets.flatMap(s => s.items)
)

// ─── File loading ─────────────────────────────────────────
async function handleFileSelect(event) {
  const file = event.target.files[0]
  if (!file) return
  event.target.value = '' // 允许重复选同一文件
  await loadConfig(file)
}

async function loadConfig(file) {
  try {
    const result = await parseConfigFile(file)
    config.sheets = result.sheets
    configFileName.value = file.name
    activeTab.value = 0
    showWriteMsg(`✓ 已加载: ${file.name}，共 ${result.sheets.length} 个页签`)
  } catch (err) {
    showWriteMsg(`✕ ${err.message}`)
  }
}

async function loadSampleConfig() {
  const blob = generateSampleConfig()
  const file = new File([blob], 'sample-config.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  await loadConfig(file)
}

// ─── Modbus handlers ──────────────────────────────────────
async function handleConnect(cfg) {
  const ok = await connect(cfg)
  if (ok) {
    showWriteMsg(`✓ 已连接 ${cfg.port}`)
    // 不自动开始轮询，等用户手动点
  } else {
    showWriteMsg(`✕ 连接失败: ${connectionError.value}`)
  }
}

function handleDisconnect() {
  disconnect()
  showWriteMsg('已断开连接')
}

function handleTogglePolling() {
  if (isPolling.value) {
    stopPolling()
    showWriteMsg('轮询已停止')
  } else {
    if (!allItems.value.length) {
      showWriteMsg('请先加载配置文件')
      return
    }
    startPolling(allItems.value, (itemId, rawValue) => {
      // 找到对应条目，更新值
      for (const sheet of config.sheets) {
        const item = sheet.items.find(i => i.id === itemId)
        if (item) {
          item.rawValue = rawValue
          item.loading = false
          break
        }
      }
    })
    showWriteMsg('开始轮询...')
  }
}

async function handleWrite({ item, rawValue }) {
  if (!isConnected.value) {
    showWriteMsg('✕ 未连接，无法写入')
    return
  }
  try {
    await writeRegister(item.register, rawValue)
    showWriteMsg(`✓ 写入 [${item.register}] ${item.name} = ${rawValue}`)
  } catch (err) {
    showWriteMsg(`✕ 写入失败: ${err.message}`)
  }
}

function showWriteMsg(msg) {
  lastWriteMsg.value = msg
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => { lastWriteMsg.value = '' }, 4000)
}

onUnmounted(() => {
  stopPolling()
  if (writeTimer) clearTimeout(writeTimer)
})
</script>

<style scoped>
.app-root {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  overflow: hidden;
}

/* ── Title Bar ──────────────────────────────────────────── */
.title-bar {
  height: 38px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  cursor: default;
}

.title-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-logo {
  color: var(--accent);
  font-size: 16px;
}

.app-name {
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-primary);
}

.config-name {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.sep {
  margin: 0 4px;
}

.title-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modbus-status-mini {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.dot.on {
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent);
}
.dot.off {
  background: var(--text-muted);
}

/* ── Main Content ───────────────────────────────────────── */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* ── Landing ────────────────────────────────────────────── */
.landing {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: var(--bg-base);
}

.landing-card {
  text-align: center;
  max-width: 480px;
}

.landing-icon {
  font-size: 48px;
  color: var(--accent);
  opacity: 0.5;
  margin-bottom: 16px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.landing-title {
  font-family: var(--font-ui);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.landing-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 28px;
  line-height: 1.6;
}

.landing-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.btn-load, .btn-sample {
  height: 38px;
  padding: 0 20px;
  border-radius: var(--radius);
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all var(--trans-fast);
  border: none;
  outline: none;
}

.btn-load {
  background: var(--accent);
  color: var(--bg-base);
}
.btn-load:hover { background: #00e8bb; transform: translateY(-1px); }

.btn-sample {
  background: transparent;
  border: 1px solid var(--border-accent);
  color: var(--accent);
}
.btn-sample:hover {
  background: var(--accent-glow);
  transform: translateY(-1px);
}

.landing-hint {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  padding: 14px 18px;
  background: var(--bg-panel);
}

.hint-item {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  text-align: left;
}
.hint-item::before {
  content: '→ ';
  color: var(--accent);
  opacity: 0.5;
}

/* ── Tab Bar ────────────────────────────────────────────── */
.tab-bar {
  display: flex;
  align-items: stretch;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  overflow-x: auto;
  min-height: 36px;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  cursor: pointer;
  position: relative;
  transition: background var(--trans-fast), color var(--trans-fast);
  white-space: nowrap;
  border-right: 1px solid var(--border-light);
}

.tab-item:hover {
  background: var(--bg-hover);
}

.tab-item.active {
  background: var(--bg-panel);
  color: var(--accent);
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
}

.tab-name {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: inherit;
}

.tab-item.active .tab-name { color: var(--accent); }
.tab-item:not(.active) .tab-name { color: var(--text-secondary); }

.tab-count {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  background: var(--bg-card);
  border-radius: 8px;
  padding: 1px 5px;
  min-width: 18px;
  text-align: center;
}

.tab-spacer { flex: 1; }

.tab-action {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 14px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  cursor: pointer;
  transition: color var(--trans-fast);
  white-space: nowrap;
  border-left: 1px solid var(--border-light);
}
.tab-action:hover { color: var(--text-primary); }

/* ── Sheet Container ────────────────────────────────────── */
.sheet-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

/* ── Status Bar ─────────────────────────────────────────── */
.status-bar {
  height: 26px;
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  flex-shrink: 0;
}

.status-left, .status-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-msg {
  font-size: 11px;
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-msg.muted { color: var(--text-muted); }
.status-msg.write-msg { color: var(--text-secondary); }

.msg-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
}

.status-info {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

.status-version {
  font-size: 10px;
  color: var(--text-muted);
  opacity: 0.5;
}

/* Tab fade transition */
.tab-fade-enter-active, .tab-fade-leave-active {
  transition: opacity 0.15s ease;
}
.tab-fade-enter-from, .tab-fade-leave-to {
  opacity: 0;
}
</style>
