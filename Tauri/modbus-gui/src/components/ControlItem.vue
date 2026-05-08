<template>
  <div
    class="control-item"
    :class="{
      'is-readonly': item.permission === 'READONLY',
      'is-readwrite': item.permission === 'READWRITE',
      'has-error': item.error,
      'is-loading': item.loading,
    }"
  >
    <!-- Label section -->
    <div class="item-label">
      <span class="item-name" :title="item.name">{{ item.name }}</span>
      <span v-if="item.unit" class="item-unit">{{ item.unit }}</span>
      <span class="item-addr mono">{{ item.register }}</span>
    </div>

    <!-- Control section -->
    <div class="item-control">
      <!-- INPUT type -->
      <template v-if="item.type === 'INPUT'">
        <div class="input-wrapper" :class="{ focused: isFocused }">
          <input
            ref="inputRef"
            :value="displayValue"
            :readonly="item.permission === 'READONLY'"
            :placeholder="item.loading ? '读取中...' : (item.error ? 'ERR' : '—')"
            class="value-input"
            :class="{
              'rw-input': item.permission === 'READWRITE',
              'ro-input': item.permission === 'READONLY',
            }"
            @focus="isFocused = true; editValue = displayValue"
            @blur="isFocused = false"
            @input="editValue = $event.target.value"
            @keydown.enter="handleWrite"
            @keydown.escape="cancelEdit"
          />
          <span v-if="item.permission === 'READWRITE'" class="rw-hint">↵</span>
          <span v-if="item.permission === 'READONLY'" class="ro-badge">RO</span>
        </div>
      </template>

      <!-- SELECT type -->
      <template v-else-if="item.type === 'SELECT'">
        <div class="select-wrapper">
          <div class="select-display" @click="toggleDropdown" :class="{ open: dropdownOpen }">
            <span class="selected-label">
              {{ selectedOptionLabel || (item.loading ? '读取中...' : '—') }}
            </span>
            <span class="select-arrow">▾</span>
          </div>
          <!-- Custom dropdown -->
          <Transition name="dropdown">
            <div v-if="dropdownOpen" class="dropdown-menu" v-click-outside="closeDropdown">
              <div
                v-for="opt in item.options"
                :key="opt.value"
                class="dropdown-item"
                :class="{ active: String(opt.value) === String(currentRawValue) }"
                @click="handleSelectOption(opt)"
              >
                <span class="opt-indicator"></span>
                {{ opt.label }}
                <span class="opt-value mono">{{ opt.value }}</span>
              </div>
              <div v-if="!item.options?.length" class="dropdown-empty">无选项</div>
            </div>
          </Transition>
        </div>
      </template>
    </div>

    <!-- Error indicator -->
    <div v-if="item.error" class="item-error" :title="item.error">!</div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { rawToDisplay, displayToRaw } from '../utils/excelParser.js'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['write'])

const inputRef = ref(null)
const isFocused = ref(false)
const editValue = ref('')
const dropdownOpen = ref(false)

// 当前原始值（从轮询更新）
const currentRawValue = computed(() => props.item.rawValue)

// 显示值（换算后）
const displayValue = computed(() => {
  if (isFocused.value) return editValue.value
  if (props.item.rawValue === null || props.item.rawValue === undefined) return ''
  return rawToDisplay(props.item.rawValue, props.item.decimals)
})

// SELECT 当前选中的 label
const selectedOptionLabel = computed(() => {
  if (!props.item.options?.length) return ''
  const raw = String(props.item.rawValue)
  const found = props.item.options.find(o => String(o.value) === raw)
  return found ? found.label : `Unknown(${raw})`
})

// 当外部 rawValue 更新时，如果没有在编辑，更新 editValue
watch(() => props.item.rawValue, (val) => {
  if (!isFocused.value) {
    editValue.value = val !== null ? rawToDisplay(val, props.item.decimals) : ''
  }
})

function handleWrite() {
  if (props.item.permission !== 'READWRITE') return
  const val = parseFloat(editValue.value)
  if (isNaN(val)) return
  const raw = displayToRaw(editValue.value, props.item.decimals)
  emit('write', { item: props.item, rawValue: raw })
  inputRef.value?.blur()
}

function cancelEdit() {
  editValue.value = displayValue.value
  inputRef.value?.blur()
}

function toggleDropdown() {
  if (props.item.permission !== 'READWRITE') return
  dropdownOpen.value = !dropdownOpen.value
}

function closeDropdown() {
  dropdownOpen.value = false
}

function handleSelectOption(opt) {
  dropdownOpen.value = false
  const raw = parseInt(opt.value, 10)
  emit('write', { item: props.item, rawValue: isNaN(raw) ? opt.value : raw })
}

// v-click-outside directive (inline)
const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => {
      if (!el.contains(e.target)) binding.value()
    }
    document.addEventListener('click', el._clickOutside, true)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside, true)
  },
}
</script>

<style scoped>
.control-item {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color var(--trans-fast), background var(--trans-fast);
  min-width: 0;
  overflow: visible;
}

.control-item:hover {
  border-color: var(--border);
}

.control-item.is-readwrite:hover {
  border-color: rgba(0, 212, 170, 0.25);
}

/* Readwrite indicator: subtle left bar */
.control-item.is-readwrite::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  background: var(--accent-dim);
  border-radius: 0 1px 1px 0;
  opacity: 0.5;
}

.control-item.has-error {
  border-color: rgba(255, 77, 106, 0.3);
}

/* Label row */
.item-label {
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
}

.item-name {
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.item-unit {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  flex-shrink: 0;
}

.item-addr {
  font-size: 9px;
  color: var(--text-muted);
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0.5;
}

/* Control row */
.item-control {
  position: relative;
}

/* INPUT */
.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.value-input {
  width: 100%;
  height: 30px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  padding: 0 28px 0 8px;
  outline: none;
  transition: border-color var(--trans-fast), color var(--trans-fast);
  text-align: right;
}

.value-input::placeholder {
  color: var(--text-muted);
  font-size: 11px;
  text-align: left;
}

.rw-input:focus {
  border-color: var(--accent-dim);
  color: var(--accent);
}

.ro-input {
  cursor: default;
  color: var(--text-primary);
}

.rw-hint {
  position: absolute;
  right: 7px;
  font-size: 11px;
  color: var(--text-muted);
  pointer-events: none;
}

.ro-badge {
  position: absolute;
  right: 6px;
  font-size: 8px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  letter-spacing: 0.05em;
  pointer-events: none;
}

/* SELECT */
.select-wrapper {
  position: relative;
}

.select-display {
  height: 30px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: border-color var(--trans-fast);
  gap: 6px;
}

.select-display:hover {
  border-color: var(--border-accent);
}

.select-display.open {
  border-color: var(--accent-dim);
}

.selected-label {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.select-arrow {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform var(--trans-fast);
}
.select-display.open .select-arrow {
  transform: rotate(180deg);
}

/* Dropdown */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 3px);
  left: 0;
  right: 0;
  background: var(--bg-panel);
  border: 1px solid var(--border-accent);
  border-radius: var(--radius);
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  z-index: 100;
  overflow: hidden;
  max-height: 180px;
  overflow-y: auto;
}

.dropdown-item {
  display: flex;
  align-items: center;
  padding: 7px 10px;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--trans-fast), color var(--trans-fast);
}

.dropdown-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.dropdown-item.active {
  color: var(--accent);
  background: var(--accent-glow-sm);
}

.opt-indicator {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.dropdown-item.active .opt-indicator {
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 4px var(--accent);
}

.opt-value {
  margin-left: auto;
  font-size: 10px;
  color: var(--text-muted);
}

.dropdown-empty {
  padding: 10px;
  text-align: center;
  color: var(--text-muted);
  font-size: 11px;
}

/* Error badge */
.item-error {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--danger);
  color: white;
  font-size: 9px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: help;
}

/* Dropdown transition */
.dropdown-enter-active, .dropdown-leave-active {
  transition: all 0.15s ease;
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
