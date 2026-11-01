<script setup lang="ts">
/**
 * 设计器三栏骨架（T13）
 *
 * 左物料 / 中画布 / 右属性，三块共享同一个 store 的 schema 与选中态。
 * T14 接物料点击添加、T15 换成真正的画布渲染、T18/T19 补属性编辑。
 */
import { computed } from 'vue'
import { useDesignerStore } from '@/stores/designer'
import Canvas from './Canvas.vue'
import MaterialPanel from './MaterialPanel.vue'
import PropertyPanel from './PropertyPanel.vue'

const store = useDesignerStore()

const selectionText = computed(() =>
  store.selectedField ? `已选中「${store.selectedField.label}」` : '未选中字段',
)
</script>

<template>
  <div class="designer">
    <header class="toolbar">
      <h1 class="toolbar__title">{{ store.schema.name }}</h1>
      <span class="toolbar__meta">
        {{ store.schema.fields.length }} 个字段 · {{ selectionText }}
      </span>
    </header>

    <div class="workspace">
      <MaterialPanel />
      <Canvas
        :fields="store.schema.fields"
        :selected-id="store.selectedId"
        @select="store.select"
      />
      <PropertyPanel :field="store.selectedField ?? null" />
    </div>
  </div>
</template>

<style scoped>
.designer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--fb-border);
}

.toolbar__title {
  margin: 0;
  font-size: 16px;
}

.toolbar__meta {
  color: var(--fb-text-muted);
  font-size: 12px;
}

.workspace {
  display: grid;
  flex: 1;
  grid-template-columns: 240px minmax(0, 1fr) 300px;
  min-height: 0;
}
</style>
