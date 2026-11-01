<script setup lang="ts">
/**
 * 画布占位（T13）
 *
 * T13 只需要证明"点击字段能切换选中"，所以先用列表渲染顶层字段；
 * T15 换成 RecursiveForm 的设计态渲染 + 选中高亮 / 删除 / 复制 / 排序。
 */
import { getFieldMeta } from '@/core/meta/field-meta'
import type { FieldNode } from '@/core/schema/types'

defineProps<{
  fields: FieldNode[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
}>()
</script>

<template>
  <main class="canvas">
    <header class="canvas__head">
      <h2 class="canvas__title">画布</h2>
      <span class="canvas__hint">点击字段可选中</span>
    </header>

    <el-empty v-if="fields.length === 0" description="还没有字段" />

    <ul v-else class="field-list">
      <li
        v-for="field in fields"
        :key="field.id"
        class="field-item"
        :class="{ 'is-selected': field.id === selectedId }"
        @click="emit('select', field.id)"
      >
        <span class="field-item__label">{{ field.label }}</span>
        <span class="field-item__meta"
          >{{ getFieldMeta(field.type).label }} · {{ field.name }}</span
        >
      </li>
    </ul>
  </main>
</template>

<style scoped>
.canvas {
  height: 100%;
  padding: 16px 20px 40px;
  overflow: auto;
}

.canvas__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.canvas__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.canvas__hint {
  color: var(--fb-text-muted);
  font-size: 12px;
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.field-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--fb-border);
  border-radius: 6px;
  background: var(--fb-bg);
  cursor: pointer;
}

.field-item:hover {
  border-color: #c7ccd4;
}

.field-item.is-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgb(64 158 255 / 18%);
}

.field-item__label {
  font-size: 13px;
}

.field-item__meta {
  color: var(--fb-text-muted);
  font-size: 12px;
}
</style>
