<script setup lang="ts">
/**
 * 画布（T15）
 *
 * 设计态不复用 RecursiveForm：运行态渲染的是"按值渲染的行"，
 * 设计态渲染的是"按 schema 渲染的节点 + 选中 / 删除 / 复制 / 排序"。
 * 子表单在设计态没有行数据，所以必须单独走一套递归渲染。
 */
import { useDesignerStore } from '@/stores/designer'
import FieldCard from './FieldCard.vue'

const store = useDesignerStore()
</script>

<template>
  <main class="canvas" @click="store.select(null)">
    <header class="canvas__head">
      <h2 class="canvas__title">画布</h2>
      <span class="canvas__hint">点击字段选中，选中后可删除 / 复制 / 排序</span>
    </header>

    <el-empty v-if="store.schema.fields.length === 0" description="点击左侧物料添加字段" />

    <div v-else class="field-list">
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
