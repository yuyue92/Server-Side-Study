<template>
  <div class="serial-panel" :class="{ collapsed: isCollapsed }">
    <!-- Panel header / toggle -->
    <div class="panel-header" @click="isCollapsed = !isCollapsed">
      <div class="header-left">
        <span class="header-icon">⬡</span>
        <span class="header-title">串口配置</span>
        <span class="status-dot" :class="connectionStatus"></span>
        <span class="status-text" :class="connectionStatus">
          {{ statusLabel }}
        </span>
      </div>
      <div class="header-right">
        <span v-if="isPolling" class="poll-badge">
          <span class="poll-dot"></span>
          轮询中
          <span v-if="stats.pollCycleMs !== null" class="poll-time">
            {{ stats.pollCycleMs }}ms/周期
          </span>
        </span>
        <span class="collapse-icon" :class="{ rotated: !isCollapsed }">▲</span>
      </div>
    </div>

    <!-- Collapsible config form -->
    <Transition name="slide">
      <div v-show="!isCollapsed" class="panel-body">
        <div class="config-grid">
          <!-- 串口 -->
          <div class="config-item">
            <label>串口</label>
            <div class="input-group">
              <input
                v-model="localConfig.port"
                :disabled="isConnected"
                placeholder="COM1 / /dev/ttyUSB0"
                class="cfg-input"
              />
              <button class="icon-btn" title="刷新串口列表" @click="refreshPorts">⟳</button>
            </div>
          </div>

          <!-- 波特率 -->
          <div class="config-item">
            <label>波特率</label>
            <select v-model.number="localConfig.baudRate" :disabled="isConnected" class="cfg-select">
              <option v-for="b in baudRates" :key="b" :value="b">{{ b }}</option>
            </select>
          </div>

          <!-- 数据位 -->
          <div class="config-item">
            <label>数据位</label>
            <select v-model.number="localConfig.dataBits" :disabled="isConnected" class="cfg-select">
              <option :value="7">7</option>
              <option :value="8">8</option>
            </select>
          </div>

          <!-- 停止位 -->
          <div class="config-item">
            <label>停止位</label>
            <select v-model.number="localConfig.stopBits" :disabled="isConnected" class="cfg-select">
              <option :value="1">1</option>
              <option :value="2">2</option>
            </select>
          </div>

          <!-- 校验位 -->
          <div class="config-item">
            <label>校验位</label>
            <select v-model="localConfig.parity" :disabled="isConnected" class="cfg-select">
              <option value="None">无</option>
              <option value="Even">偶校验</option>
              <option value="Odd">奇校验</option>
            </select>
          </div>

          <!-- 从站 ID -->
          <div class="config-item">
            <label>从站 ID</label>
            <input
              v-model.number="localConfig.slaveId"
              :disabled="isConnected"
              type="number"
              min="1"
              max="247"
              class="cfg-input"
            />
          </div>

          <!-- 轮询间隔 -->
          <div class="config-item">
            <label>轮询间隔</label>
            <div class="input-group">
              <input
                v-model.number="localConfig.pollInterval"
                type="number"
                min="0"
                max="60000"
                class="cfg-input"
                title="上一周期全部读完后的等待时间，0=无等待"
              />
              <span class="unit-badge">ms</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="panel-actions">
          <div v-if="connectionError" class="error-msg">
            <span class="err-icon">✕</span> {{ connectionError }}
          </div>
          <div class="btn-group">
            <button
              v-if="!isConnected"
              class="btn btn-connect"
              :disabled="connecting"
              @click="handleConnect"
            >
              <span v-if="connecting" class="spinner"></span>
              {{ connecting ? '连接中...' : '连接' }}
            </button>
            <template v-else>
              <button
                class="btn btn-poll"
                :class="{ active: isPolling }"
                @click="togglePolling"
              >
                {{ isPolling ? '停止轮询' : '开始轮询' }}
              </button>
              <button class="btn btn-disconnect" @click="handleDisconnect">
                断开
              </button>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'

const props = defineProps({
  isConnected: Boolean,
  isPolling: Boolean,
  connectionError: String,
  stats: Object,
})

const emit = defineEmits(['connect', 'disconnect', 'togglePolling'])

const isCollapsed = ref(false)
const connecting = ref(false)

const baudRates = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200]

const localConfig = reactive({
  port: '',
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'None',
  slaveId: 1,
  pollInterval: 500,
})

const connectionStatus = computed(() => {
  if (props.isConnected) return 'connected'
  if (props.connectionError) return 'error'
  return 'idle'
})

const statusLabel = computed(() => {
  if (props.isConnected) return '已连接'
  if (connecting.value) return '连接中...'
  if (props.connectionError) return '连接失败'
  return '未连接'
})

async function handleConnect() {
  connecting.value = true
  emit('connect', { ...localConfig })
  // 父组件控制实际连接，这里仅触发
  setTimeout(() => { connecting.value = false }, 1000)
}

function handleDisconnect() {
  emit('disconnect')
}

function togglePolling() {
  emit('togglePolling')
}

function refreshPorts() {
  // TODO: invoke('get_available_ports')
  console.log('[串口] 刷新串口列表（预留）')
}
</script>

<style scoped>
.serial-panel {
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  cursor: pointer;
  transition: background var(--trans-fast);
  min-height: 40px;
}
.panel-header:hover { background: var(--bg-hover); }

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  color: var(--accent);
  font-size: 14px;
}

.header-title {
  font-family: var(--font-ui);
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.05em;
  color: var(--text-primary);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.connected { background: var(--status-connected); box-shadow: 0 0 6px var(--accent); }
.status-dot.idle { background: var(--status-idle); }
.status-dot.error { background: var(--status-disconnected); }

.status-text {
  font-size: 11px;
  font-family: var(--font-mono);
}
.status-text.connected { color: var(--accent); }
.status-text.idle { color: var(--warning); }
.status-text.error { color: var(--danger); }

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.poll-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--accent);
  background: var(--accent-glow-sm);
  border: 1px solid var(--border-accent);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
}

.poll-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

.poll-time {
  color: var(--text-secondary);
  margin-left: 2px;
}

.collapse-icon {
  color: var(--text-muted);
  font-size: 10px;
  transition: transform var(--trans);
}
.collapse-icon.rotated { transform: rotate(180deg); }

/* Form */
.panel-body {
  padding: 12px 16px 14px;
  border-top: 1px solid var(--border-light);
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px 16px;
  margin-bottom: 12px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

label {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cfg-input, .cfg-select {
  flex: 1;
  height: 28px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 0 8px;
  outline: none;
  transition: border-color var(--trans-fast);
  min-width: 0;
}
.cfg-input:focus, .cfg-select:focus {
  border-color: var(--accent-dim);
}
.cfg-input:disabled, .cfg-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.cfg-select option { background: var(--bg-card); }

.unit-badge {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  padding: 0 4px;
  white-space: nowrap;
}

.icon-btn {
  width: 28px;
  height: 28px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  transition: all var(--trans-fast);
}
.icon-btn:hover {
  color: var(--accent);
  border-color: var(--border-accent);
}

/* Actions */
.panel-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.error-msg {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--danger);
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-group {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.btn {
  height: 28px;
  padding: 0 16px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all var(--trans-fast);
  outline: none;
}

.btn-connect {
  background: var(--accent);
  color: var(--bg-base);
}
.btn-connect:hover:not(:disabled) {
  background: #00e8bb;
}
.btn-connect:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-poll {
  background: transparent;
  border-color: var(--border-accent);
  color: var(--accent);
}
.btn-poll:hover, .btn-poll.active {
  background: var(--accent-glow);
}

.btn-disconnect {
  background: transparent;
  border-color: rgba(255, 77, 106, 0.4);
  color: var(--danger);
}
.btn-disconnect:hover {
  background: rgba(255, 77, 106, 0.1);
}

/* Spinner */
.spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid rgba(0,0,0,0.3);
  border-top-color: var(--bg-base);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Slide transition */
.slide-enter-active, .slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.slide-enter-from, .slide-leave-to {
  max-height: 0;
  opacity: 0;
}
.slide-enter-to, .slide-leave-from {
  max-height: 300px;
  opacity: 1;
}
</style>
