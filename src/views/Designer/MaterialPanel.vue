<script setup lang="ts">
/**
 * 物料区（T14 点击添加 / T16 拖拽克隆）
 *
 * 物料列表本身永远不增删：拖拽组配置为 pull:'clone' + put:false，
 * 拖出去的是 createField 新造的节点（新 id + props 深拷贝）。
 * 点击添加保留，作为拖拽的兜底操作。
 */
import { ref } from 'vue'
import { useDraggable } from 'vue-draggable-plus'
import { FIELD_META_LIST } from '@/core/meta/field-meta'
import type { FieldMeta } from '@/core/meta/field-meta'
import { createField } from '@/core/schema/factory'
import type { FieldType } from '@/core/schema/types'
import { useDesignerStore } from '@/stores/designer'
import { allowsNestedDrop } from './drag'
import { fieldIcon } from './field-icons'

const store = useDesignerStore()

const materials = ref<FieldMeta[]>([...FIELD_META_LIST])
const listRef = ref<HTMLElement>()

/** 拖出去的是 FieldNode 而不是物料元数据；库要求 clone 返回同 T，这里做类型桥接 */
function toField(meta: FieldMeta): FieldMeta {
  return createField(meta.type) as unknown as FieldMeta
}

useDraggable<FieldMeta>(listRef, materials, {
  group: { name: 'fields', pull: 'clone', put: false },
  sort: false,
  // 与画布保持一致：统一走 Sortable 的 fallback，避免原生 HTML5 拖拽的 ghost 差异
  forceFallback: true,
  animation: 150,
  // 物料拖拽时源列表是这里，onMove 由它来裁决；落在子表单里要让位给子列表
  onMove: allowsNestedDrop,
  clone: toField,
})

function add(type: FieldType): void {
  store.addField(type)
}
</script>

<template>
  <aside class="panel">
    <h2 class="panel__title">物料</h2>

    <ul ref="listRef" class="materials">
      <li v-for="meta in materials" :key="meta.type">
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

    <p class="panel__hint">点击或拖拽添加到画布</p>
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
  cursor: grab;
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
