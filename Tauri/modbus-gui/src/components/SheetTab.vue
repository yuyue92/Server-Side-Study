<template>
  <div class="sheet-view">
    <!-- Empty state -->
    <div v-if="!items.length" class="empty-state">
      <div class="empty-icon">⬡</div>
      <div class="empty-text">该页签暂无配置条目</div>
    </div>

    <!-- Stats bar -->
    <div v-else class="sheet-stats">
      <span class="stat-item">
        <span class="stat-label">条目</span>
        <span class="stat-val mono">{{ items.length }}</span>
      </span>
      <span class="stat-divider">·</span>
      <span class="stat-item">
        <span class="stat-label">网格</span>
        <span class="stat-val mono">{{ rows }} × {{ COLS }}</span>
      </span>
      <span class="stat-divider">·</span>
      <span class="stat-item">
        <span class="stat-label">可写</span>
        <span class="stat-val mono accent">{{ rwCount }}</span>
      </span>
      <span class="stat-divider">·</span>
      <span class="stat-item">
        <span class="stat-label">只读</span>
        <span class="stat-val mono">{{ roCount }}</span>
      </span>
    </div>

    <!-- Grid -->
    <div class="items-grid" :style="gridStyle">
      <ControlItem
        v-for="item in items"
        :key="item.id"
        :item="item"
        @write="(payload) => emit('write', payload)"
      />
      <!-- Empty placeholders to fill last row -->
      <div
        v-for="i in placeholderCount"
        :key="`ph-${i}`"
        class="placeholder-cell"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ControlItem from './ControlItem.vue'

const COLS = 4

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['write'])

const rows = computed(() => Math.ceil(props.items.length / COLS))
const rwCount = computed(() => props.items.filter(i => i.permission === 'READWRITE').length)
const roCount = computed(() => props.items.filter(i => i.permission === 'READONLY').length)

const placeholderCount = computed(() => {
  const total = props.items.length
  const remainder = total % COLS
  return remainder === 0 ? 0 : COLS - remainder
})

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${COLS}, 1fr)`,
}))
</script>

<style scoped>
.sheet-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* Stats bar */
.sheet-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  text-transform: uppercase;
}

.stat-val {
  font-size: 12px;
  color: var(--text-secondary);
}

.stat-val.accent { color: var(--accent); }

.stat-divider {
  color: var(--text-muted);
  font-size: 12px;
}

/* Grid */
.items-grid {
  flex: 1;
  display: grid;
  gap: 8px;
  padding: 12px 16px;
  overflow-y: auto;
  align-content: start;
}

.placeholder-cell {
  background: transparent;
  border: 1px dashed var(--border-light);
  border-radius: var(--radius);
  opacity: 0.3;
  min-height: 68px;
}

/* Empty state */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 32px;
  opacity: 0.3;
}

.empty-text {
  font-size: 13px;
  font-family: var(--font-mono);
}
</style>
