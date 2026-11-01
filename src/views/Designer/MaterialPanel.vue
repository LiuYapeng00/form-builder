<script setup lang="ts">
/**
 * 物料区（T14）
 *
 * 只从注册表渲染类型与图标；点击即添加到根画布。
 * 拖拽在 T16 接入，届时这里保留点击作为拖拽的兜底操作。
 */
import { FIELD_META_LIST } from '@/core/meta/field-meta'
import type { FieldType } from '@/core/schema/types'
import { useDesignerStore } from '@/stores/designer'
import { fieldIcon } from './field-icons'

const store = useDesignerStore()

function add(type: FieldType): void {
  store.addField(type)
}
</script>

<template>
  <aside class="panel">
    <h2 class="panel__title">物料</h2>

    <ul class="materials">
      <li v-for="meta in FIELD_META_LIST" :key="meta.type">
        <button type="button" class="material" @click="add(meta.type)">
          <component
            :is="fieldIcon(meta.icon)"
            v-if="fieldIcon(meta.icon)"
            class="material__icon"
          />
          <span>{{ meta.label }}</span>
        </button>
      </li>
    </ul>

    <p class="panel__hint">点击添加到画布</p>
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 6px;
  border: 1px solid var(--fb-border);
  border-radius: 6px;
  background: var(--fb-bg);
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}

.material:hover {
  border-color: #409eff;
  color: #409eff;
}

.material__icon {
  width: 14px;
  height: 14px;
}
</style>
