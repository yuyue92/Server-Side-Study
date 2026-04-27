<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="header-logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M2 17l10 5 10-5" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M2 12l10 5 10-5" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <span class="header-title">FileDrop</span>
      </div>
      <div class="header-meta">
        <span class="local-addr">
          <span class="label">本机 //</span>
          <span class="value">{{ localAddress || '检测中…' }}</span>
        </span>
        <div class="conn-badge" :class="connStatus">
          <span class="conn-dot"></span>
          {{ connLabel }}
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="main">
      <!-- Connect panel -->
      <section class="panel">
        <div class="panel-label">TARGET</div>
        <div class="connect-row">
          <div class="input-wrap">
            <span class="input-prefix">//</span>
            <input
              v-model="targetIP"
              class="ip-input"
              placeholder="192.168.1.x"
              :disabled="connStatus === 'connected'"
              @keyup.enter="handleConnect"
            />
          </div>
          <button
            class="btn"
            :class="connStatus === 'connected' ? 'btn-danger' : 'btn-primary'"
            @click="connStatus === 'connected' ? handleDisconnect() : handleConnect()"
            :disabled="connecting"
          >
            <span v-if="connecting" class="spinner"></span>
            <span v-else>{{ connStatus === 'connected' ? '断开' : '连接' }}</span>
          </button>
        </div>
        <div v-if="statusMsg" class="status-msg" :class="statusType">
          <span class="status-icon">{{ statusIcons[statusType] }}</span>
          {{ statusMsg }}
        </div>
      </section>

      <!-- Divider -->
      <div class="divider"><span>TRANSFER</span></div>

      <!-- File send panel -->
      <section class="panel">
        <div class="panel-label">SEND</div>
        <div class="file-row">
          <div class="file-info" :class="{ 'has-file': selectedFile }">
            <template v-if="selectedFile">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex-shrink:0">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="var(--accent)" stroke-width="1.5"/>
                <path d="M14 2v6h6" stroke="var(--accent)" stroke-width="1.5"/>
              </svg>
              <span class="file-name">{{ selectedFile.name }}</span>
              <span class="file-size">{{ formatSize(selectedFile.size) }}</span>
            </template>
            <template v-else>
              <span class="file-empty">— 未选择文件 —</span>
            </template>
          </div>
          <button class="btn btn-ghost" @click="handleSelectFile" :disabled="isSending">
            选择文件
          </button>
          <button
            class="btn btn-primary"
            @click="handleSend"
            :disabled="!selectedFile || connStatus !== 'connected' || isSending"
          >
            <span v-if="isSending" class="spinner"></span>
            <span v-else>发送</span>
          </button>
        </div>
      </section>

      <!-- Progress panel -->
      <section v-if="transfer" class="panel transfer-panel" :class="transfer.status">
        <div class="panel-label">PROGRESS</div>
        <div class="transfer-header">
          <span class="transfer-filename">{{ transfer.fileName }}</span>
          <span class="transfer-pct">{{ transfer.percent }}%</span>
        </div>
        <div class="progress-track">
          <div
            class="progress-bar"
            :style="{ width: transfer.percent + '%' }"
            :class="{ complete: transfer.percent >= 100 }"
          ></div>
        </div>
        <div class="transfer-meta">
          <span>{{ formatSize(transfer.transferred) }} / {{ formatSize(transfer.fileSize) }}</span>
          <span class="transfer-speed">{{ formatSpeed(transfer.speedBps) }}</span>
        </div>
        <div v-if="transfer.statusMsg" class="transfer-status-msg" :class="transfer.statusClass">
          {{ transfer.statusMsg }}
        </div>
      </section>

      <!-- Empty state -->
      <div v-if="!transfer" class="empty-transfer">
        <div class="empty-glyph">[ _ ]</div>
        <div class="empty-text">等待传输任务</div>
      </div>
    </main>

    <!-- Incoming file offer modal -->
    <Transition name="modal">
      <div v-if="incomingOffer" class="modal-overlay" @click.self="rejectOffer">
        <div class="modal">
          <div class="modal-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="var(--accent)" stroke-width="1.5"/>
              <polyline points="7 10 12 15 17 10" stroke="var(--accent)" stroke-width="1.5"/>
              <line x1="12" y1="15" x2="12" y2="3" stroke="var(--accent)" stroke-width="1.5"/>
            </svg>
          </div>
          <h2 class="modal-title">收到文件请求</h2>
          <div class="modal-file">
            <div class="modal-row">
              <span class="modal-key">文件名</span>
              <span class="modal-val">{{ incomingOffer.fileName }}</span>
            </div>
            <div class="modal-row">
              <span class="modal-key">大小</span>
              <span class="modal-val">{{ formatSize(incomingOffer.fileSize) }}</span>
            </div>
          </div>
          <p class="modal-hint">文件将保存到您的下载目录</p>
          <div class="modal-actions">
            <button class="btn btn-danger" @click="rejectOffer">拒绝</button>
            <button class="btn btn-primary" @click="acceptOffer">接收</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Log strip at bottom -->
    <div class="log-strip">
      <span class="log-cursor">›</span>
      <span class="log-text">{{ lastLog }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'

// ── State ──────────────────────────────────────────────────────────────────────
const localAddress = ref('')
const targetIP = ref('')
const connStatus = ref('disconnected') // disconnected | connecting | connected
const connecting = ref(false)
const statusMsg = ref('')
const statusType = ref('info') // info | success | error | warn
const lastLog = ref('系统就绪，等待操作…')

const selectedFile = ref(null) // { name, size, path }
const isSending = ref(false)

const transfer = ref(null)
/*
transfer shape:
{
  transferId, fileName, fileSize, transferred, speedBps,
  percent, status, statusMsg, statusClass
}
*/

const incomingOffer = ref(null)
// { transferId, fileName, fileSize }

const statusIcons = {
  info: '○',
  success: '●',
  error: '✕',
  warn: '△',
}

// ── Computed ──────────────────────────────────────────────────────────────────
const connLabel = computed(() => {
  if (connStatus.value === 'connected') return '已连接'
  if (connStatus.value === 'connecting') return '连接中'
  return '未连接'
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────
const unlisten = []

onMounted(async () => {
  try {
    localAddress.value = await invoke('get_local_address')
  } catch (e) {
    localAddress.value = '127.0.0.1:8848'
  }

  // Connection status events
  unlisten.push(await listen('connection_status', ({ payload }) => {
    const { status, message } = payload
    if (status === 'connected') {
      connStatus.value = 'connected'
      setStatus(message, 'success')
    } else if (status === 'disconnected') {
      connStatus.value = 'disconnected'
      setStatus(message, 'info')
    }
    log(message)
  }))

  // Incoming file offer
  unlisten.push(await listen('file_offer', ({ payload }) => {
    incomingOffer.value = {
      transferId: payload.transfer_id,
      fileName: payload.file_name,
      fileSize: payload.file_size,
    }
    log(`收到文件请求: ${payload.file_name}`)
  }))

  // Transfer progress
  unlisten.push(await listen('transfer_progress', ({ payload }) => {
    const pct = Math.min(100, Math.round((payload.transferred / payload.file_size) * 100))
    transfer.value = {
      ...transfer.value,
      transferId: payload.transfer_id,
      fileName: payload.file_name,
      fileSize: payload.file_size,
      transferred: payload.transferred,
      speedBps: payload.speed_bps,
      percent: pct,
      status: 'active',
    }
  }))

  // Transfer status events
  unlisten.push(await listen('transfer_status', ({ payload }) => {
    const { status, message } = payload
    log(message)

    if (status === 'hashing') {
      setStatus(message, 'info')
    } else if (status === 'waiting_accept') {
      setStatus(message, 'warn')
    } else if (status === 'send_complete' || status === 'receive_complete') {
      isSending.value = false
      if (transfer.value) {
        transfer.value = {
          ...transfer.value,
          percent: 100,
          status: 'complete',
          statusMsg: message,
          statusClass: 'success',
        }
      }
      setStatus(message, 'success')
    } else if (status === 'verifying') {
      setStatus(message, 'info')
    } else if (status === 'error') {
      isSending.value = false
      if (transfer.value) {
        transfer.value = {
          ...transfer.value,
          status: 'error',
          statusMsg: message,
          statusClass: 'error',
        }
      }
      setStatus(message, 'error')
    }
  }))
})

onUnmounted(() => {
  unlisten.forEach(fn => fn())
})

// ── Methods ───────────────────────────────────────────────────────────────────
function log(msg) {
  lastLog.value = msg
}

function setStatus(msg, type = 'info') {
  statusMsg.value = msg
  statusType.value = type
}

async function handleConnect() {
  if (!targetIP.value.trim()) {
    setStatus('请输入目标 IP 地址', 'error')
    return
  }
  connecting.value = true
  connStatus.value = 'connecting'
  setStatus('正在连接…', 'info')
  try {
    await invoke('connect_to_peer', { ip: targetIP.value.trim() })
    connStatus.value = 'connected'
    setStatus(`已连接到 ${targetIP.value}`, 'success')
    log(`已连接到 ${targetIP.value}`)
  } catch (e) {
    connStatus.value = 'disconnected'
    setStatus(String(e), 'error')
    log(`连接失败: ${e}`)
  } finally {
    connecting.value = false
  }
}

async function handleDisconnect() {
  try {
    await invoke('disconnect')
  } catch {}
  connStatus.value = 'disconnected'
  setStatus('已断开连接', 'info')
}

async function handleSelectFile() {
  try {
    const result = await open({
      multiple: false,
      title: '选择要发送的文件',
    })
    if (result) {
      // result is a string path in Tauri v2
      const path = typeof result === 'string' ? result : result.path
      const name = path.split(/[\\/]/).pop()
      // We can't easily get file size from dialog; we'll show path
      selectedFile.value = { name, path, size: 0 }
      log(`已选择: ${name}`)

      // Try to get actual file size via Tauri fs if available, otherwise show 0
      // For now show the file name and path is enough
    }
  } catch (e) {
    log(`选择文件失败: ${e}`)
  }
}

async function handleSend() {
  if (!selectedFile.value || connStatus.value !== 'connected') return
  isSending.value = true
  transfer.value = {
    transferId: '',
    fileName: selectedFile.value.name,
    fileSize: selectedFile.value.size,
    transferred: 0,
    speedBps: 0,
    percent: 0,
    status: 'pending',
    statusMsg: '准备发送…',
    statusClass: 'info',
  }
  setStatus('准备发送…', 'info')
  log(`开始发送: ${selectedFile.value.name}`)
  try {
    await invoke('send_file', { filePath: selectedFile.value.path })
  } catch (e) {
    isSending.value = false
    setStatus(String(e), 'error')
    log(`发送失败: ${e}`)
    if (transfer.value) {
      transfer.value.status = 'error'
      transfer.value.statusMsg = String(e)
      transfer.value.statusClass = 'error'
    }
  }
}

async function acceptOffer() {
  if (!incomingOffer.value) return
  const offer = incomingOffer.value
  incomingOffer.value = null

  // Use downloads directory (Tauri resolves this)
  // Default to home directory fallback
  let savePath = '~'
  try {
    const { homeDir } = await import('@tauri-apps/api/path')
    savePath = await homeDir()
    // Try downloads
    const { downloadDir } = await import('@tauri-apps/api/path')
    savePath = await downloadDir()
  } catch {}

  transfer.value = {
    transferId: offer.transferId,
    fileName: offer.fileName,
    fileSize: offer.fileSize,
    transferred: 0,
    speedBps: 0,
    percent: 0,
    status: 'active',
    statusMsg: '接收中…',
    statusClass: 'info',
  }

  try {
    await invoke('respond_to_offer', {
      transferId: offer.transferId,
      accept: true,
      savePath,
    })
    log(`开始接收: ${offer.fileName}`)
  } catch (e) {
    setStatus(String(e), 'error')
    log(`接收失败: ${e}`)
  }
}

async function rejectOffer() {
  if (!incomingOffer.value) return
  const offer = incomingOffer.value
  incomingOffer.value = null
  try {
    await invoke('respond_to_offer', {
      transferId: offer.transferId,
      accept: false,
      savePath: '',
    })
    log(`已拒绝文件: ${offer.fileName}`)
  } catch {}
}

// ── Formatters ────────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function formatSpeed(bps) {
  if (!bps) return ''
  if (bps < 1024) return `${bps} B/s`
  if (bps < 1024 ** 2) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / 1024 ** 2).toFixed(1)} MB/s`
}
</script>

<style scoped>
/* ── App Layout ───────────────────────────────────────────────────────────── */
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
  overflow: hidden;
}

/* ── Header ────────────────────────────────────────────────────────────────── */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  user-select: none;
  flex-shrink: 0;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text);
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 20px;
}

.local-addr {
  display: flex;
  gap: 6px;
  align-items: center;
}

.local-addr .label {
  color: var(--text-muted);
  font-size: 11px;
}

.local-addr .value {
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 500;
}

.conn-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 3px;
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text-muted);
  transition: all 0.2s;
}

.conn-badge.connected {
  border-color: var(--green);
  color: var(--green);
  background: var(--green-glow);
}

.conn-badge.connecting {
  border-color: var(--yellow);
  color: var(--yellow);
}

.conn-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-dot 2s ease-in-out infinite;
}

/* ── Main ───────────────────────────────────────────────────────────────────── */
.main {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ── Panel ─────────────────────────────────────────────────────────────────── */
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 16px 18px;
  animation: fadeIn 0.3s ease;
  position: relative;
}

.panel-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--text-muted);
  margin-bottom: 12px;
}

/* ── Connect row ────────────────────────────────────────────────────────────── */
.connect-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--surface2);
  overflow: hidden;
  transition: border-color 0.15s;
}

.input-wrap:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent-glow);
}

.input-prefix {
  padding: 0 10px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  user-select: none;
  border-right: 1px solid var(--border);
}

.ip-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text);
  font-family: var(--mono);
  font-size: 13px;
  padding: 8px 12px;
}

.ip-input::placeholder {
  color: var(--text-muted);
}

.ip-input:disabled {
  opacity: 0.5;
}

/* ── Status message ─────────────────────────────────────────────────────────── */
.status-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 12px;
  padding: 7px 10px;
  border-radius: 3px;
  border-left: 2px solid transparent;
}

.status-msg.info   { color: var(--text-dim); border-color: var(--border); background: var(--surface2); }
.status-msg.success { color: var(--green); border-color: var(--green); background: var(--green-glow); }
.status-msg.error  { color: var(--red); border-color: var(--red); background: rgba(239,68,68,0.08); }
.status-msg.warn   { color: var(--yellow); border-color: var(--yellow); background: rgba(245,158,11,0.08); }

.status-icon {
  font-weight: 700;
  flex-shrink: 0;
}

/* ── Divider ────────────────────────────────────────────────────────────────── */
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  color: var(--text-muted);
  font-size: 9px;
  letter-spacing: 0.2em;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

/* ── File row ─────────────────────────────────────────────────────────────── */
.file-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.file-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 3px;
  min-width: 0;
  color: var(--text-muted);
  font-size: 12px;
  overflow: hidden;
}

.file-info.has-file {
  border-color: rgba(61, 142, 255, 0.3);
  color: var(--text);
}

.file-empty {
  font-style: italic;
  color: var(--text-muted);
}

.file-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.file-size {
  flex-shrink: 0;
  color: var(--text-dim);
  font-size: 11px;
}

/* ── Transfer panel ─────────────────────────────────────────────────────────── */
.transfer-panel {
  animation: fadeIn 0.3s ease;
}

.transfer-panel.complete {
  border-color: rgba(34, 197, 94, 0.3);
}

.transfer-panel.error {
  border-color: rgba(239, 68, 68, 0.3);
}

.transfer-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}

.transfer-filename {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 12px;
}

.transfer-pct {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.02em;
  flex-shrink: 0;
}

.progress-track {
  height: 4px;
  background: var(--surface2);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent) 0%, #60a5fa 100%);
  border-radius: 2px;
  transition: width 0.2s ease;
  background-size: 200% auto;
}

.progress-bar.complete {
  background: var(--green);
}

.transfer-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
}

.transfer-speed {
  color: var(--accent);
  font-weight: 500;
}

.transfer-status-msg {
  margin-top: 10px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 3px;
}

.transfer-status-msg.success { color: var(--green); background: var(--green-glow); }
.transfer-status-msg.error { color: var(--red); background: rgba(239,68,68,0.08); }
.transfer-status-msg.info { color: var(--text-dim); background: var(--surface2); }

/* ── Empty state ─────────────────────────────────────────────────────────────── */
.empty-transfer {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 30px;
  color: var(--text-muted);
}

.empty-glyph {
  font-size: 22px;
  letter-spacing: 0.2em;
  opacity: 0.4;
}

.empty-text {
  font-size: 11px;
  letter-spacing: 0.12em;
  opacity: 0.5;
}

/* ── Buttons ─────────────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 3px;
  border: 1px solid var(--border);
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
  background: var(--surface2);
  color: var(--text-dim);
  letter-spacing: 0.04em;
}

.btn:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--text-muted);
}

.btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #5ba0ff;
  border-color: #5ba0ff;
  color: #fff;
}

.btn-danger {
  background: rgba(239,68,68,0.12);
  border-color: var(--red);
  color: var(--red);
}

.btn-danger:hover:not(:disabled) {
  background: rgba(239,68,68,0.2);
}

.btn-ghost {
  background: transparent;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}

/* ── Log strip ───────────────────────────────────────────────────────────────── */
.log-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.log-cursor {
  color: var(--accent);
  font-weight: 700;
}

.log-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Modal ─────────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 15, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border-active);
  border-radius: 6px;
  padding: 28px 32px;
  width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  animation: slideIn 0.2s ease;
  box-shadow: 0 0 40px rgba(61, 142, 255, 0.12);
}

.modal-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--accent-glow);
  border: 1px solid rgba(61, 142, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.04em;
}

.modal-file {
  width: 100%;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.modal-row {
  display: flex;
  padding: 8px 14px;
  gap: 12px;
  align-items: baseline;
}

.modal-row + .modal-row {
  border-top: 1px solid var(--border);
}

.modal-key {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  width: 48px;
  flex-shrink: 0;
}

.modal-val {
  font-size: 13px;
  color: var(--text);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-hint {
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
}

.modal-actions {
  display: flex;
  gap: 10px;
  width: 100%;
}

.modal-actions .btn {
  flex: 1;
  justify-content: center;
}

/* ── Transitions ─────────────────────────────────────────────────────────────── */
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.2s;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
</style>
