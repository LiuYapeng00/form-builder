<script setup lang="ts">
/**
 * 属性面板占位（T13）
 *
 * T13 只做"选中谁就回显谁"，编辑能力在 T18（基础 tab）和 T19（选项 / 校验 / 联动）。
 */
import { getFieldMeta } from '@/core/meta/field-meta'
import type { FieldNode } from '@/core/schema/types'

defineProps<{
  field: FieldNode | null
}>()
</script>

<template>
  <aside class="panel">
    <h2 class="panel__title">属性</h2>

    <el-empty v-if="!field" :image-size="48" description="未选中字段" />

    <dl v-else class="props">
      <dt>类型</dt>
      <dd>{{ getFieldMeta(field.type).label }}</dd>
      <dt>标题</dt>
      <dd>{{ field.label }}</dd>
      <dt>字段名</dt>
      <dd class="mono">{{ field.name }}</dd>
      <dt>字段 ID</dt>
      <dd class="mono">{{ field.id }}</dd>
    </dl>

    <p class="panel__hint">T18 接入属性编辑</p>
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
  border-left: 1px solid var(--fb-border);
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

.props {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 8px 12px;
  margin: 0;
  font-size: 12px;
}

.props dt {
  color: var(--fb-text-muted);
}

.props dd {
  margin: 0;
  word-break: break-all;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
</style>
