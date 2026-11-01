<script setup lang="ts">
/**
 * 物料区占位（T13）
 *
 * 只从注册表渲染类型名，证明"物料区由 field-meta 驱动"；
 * 点击添加在 T14，拖拽在 T16。
 */
import { FIELD_META_LIST } from '@/core/meta/field-meta'
</script>

<template>
  <aside class="panel">
    <h2 class="panel__title">物料</h2>

    <ul class="materials">
      <li v-for="meta in FIELD_META_LIST" :key="meta.type" class="material">
        {{ meta.label }}
      </li>
    </ul>

    <p class="panel__hint">T14 接入点击添加</p>
  </aside>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 16px 12px;
  overflow: auto;
  border-right: 1px solid var(--fb-border);
  background: var(--fb-bg-muted);
}

.panel__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.panel__hint {
  margin: auto 0 0;
  color: var(--fb-text-muted);
  font-size: 12px;
}

.materials {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.material {
  padding: 8px 6px;
  border: 1px solid var(--fb-border);
  border-radius: 6px;
  background: var(--fb-bg);
  font-size: 12px;
  text-align: center;
}
</style>
