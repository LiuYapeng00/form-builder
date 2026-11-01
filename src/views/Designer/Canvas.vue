<script setup lang="ts">
/**
 * 画布（T15 设计态渲染 / T16 拖拽排序）
 *
 * 设计态不复用 RecursiveForm：运行态渲染的是"按值渲染的行"，
 * 设计态渲染的是"按 schema 渲染的节点 + 选中 / 删除 / 复制 / 排序"。
 * 子表单在设计态没有行数据，所以必须单独走一套递归渲染。
 */
import { computed, ref } from 'vue'
import { useDraggable } from 'vue-draggable-plus'
import type { FieldNode } from '@/core/schema/types'
import { useDesignerStore } from '@/stores/designer'
import FieldCard from './FieldCard.vue'

const store = useDesignerStore()
const listRef = ref<HTMLElement>()

/** 拖拽库回传的是新数组；setter 里走 commit，快照仍拍在变更之前 */
const fieldsModel = computed<FieldNode[]>({
  get: () => store.schema.fields,
  set: (next) => store.replaceFields(next),
})

useDraggable<FieldNode>(listRef, fieldsModel, {
  group: { name: 'fields', pull: true, put: true },
  // 只允许直接子卡片参与排序，避免 T17 子表单嵌套时父子列表互相抢
  draggable: '> .card',
  handle: '.card__head',
  // 操作按钮不触发拖拽，否则点"删除"可能变成拖动
  filter: '.card__actions',
  // 原生 HTML5 拖拽在部分浏览器/嵌套列表下 ghost 会漂移，统一走 Sortable 的 fallback
  forceFallback: true,
  animation: 150,
  onAdd: (event) => {
    // 物料拖入时 data 是物料元数据，clonedData 才是新造的 FieldNode
    if (event.clonedData?.id) store.select(event.clonedData.id)
  },
})
</script>

<template>
  <main class="canvas" @click="store.select(null)">
    <header class="canvas__head">
      <h2 class="canvas__title">画布</h2>
      <span class="canvas__hint">拖拽卡片头部排序，点击字段选中</span>
    </header>

    <el-empty v-if="store.schema.fields.length === 0" description="点击或拖拽左侧物料添加字段" />

    <div v-else ref="listRef" class="field-list">
      <FieldCard
        v-for="(field, index) in store.schema.fields"
        :key="field.id"
        :field="field"
        :index="index"
        :total="store.schema.fields.length"
      />
    </div>
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
  gap: 12px;
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
}
</style>
