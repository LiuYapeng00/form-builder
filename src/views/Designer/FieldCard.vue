<script setup lang="ts">
/**
 * 画布上的字段卡片（T15）
 *
 * 自递归：子表单的 children 用同一个组件渲染，嵌套层级的选中 / 操作行为保持一致。
 * 卡片只负责显示与把 id 传回 store，不直接改 schema。
 */
import { computed } from 'vue'
import { fieldComponent } from '@/components/fields'
import { defaultValueForField } from '@/core/engine/values'
import { getFieldMeta } from '@/core/meta/field-meta'
import type { FieldNode } from '@/core/schema/types'
import { useDesignerStore } from '@/stores/designer'
import { fieldIcon } from './field-icons'

const props = defineProps<{
  field: FieldNode
  index: number
  total: number
}>()

const store = useDesignerStore()

const selected = computed(() => store.selectedId === props.field.id)
const icon = computed(() => fieldIcon(getFieldMeta(props.field.type).icon))
const previewValue = computed(() => defaultValueForField(props.field))
const children = computed(() => props.field.children ?? [])
</script>

<template>
  <article class="card" :class="{ 'is-selected': selected }" @click.stop="store.select(field.id)">
    <header class="card__head">
      <component :is="icon" v-if="icon" class="card__icon" />
      <span class="card__label">{{ field.label }}</span>
      <span class="card__type">{{ getFieldMeta(field.type).label }}</span>

      <div class="card__actions" @click.stop>
        <el-button link size="small" :disabled="index === 0" @click="store.moveField(field.id, -1)">
          上移
        </el-button>
        <el-button
          link
          size="small"
          :disabled="index === total - 1"
          @click="store.moveField(field.id, 1)"
        >
          下移
        </el-button>
        <el-button link size="small" @click="store.duplicateField(field.id)">复制</el-button>
        <el-button link size="small" type="danger" @click="store.removeField(field.id)">
          删除
        </el-button>
      </div>
    </header>

    <div class="card__body">
      <div v-if="field.type === 'subform'" class="subform">
        <FieldCard
          v-for="(child, childIndex) in children"
          :key="child.id"
          :field="child"
          :index="childIndex"
          :total="children.length"
        />
        <p v-if="children.length === 0" class="subform__empty">子表单还没有字段</p>
      </div>

      <el-divider v-else-if="field.type === 'divider'" content-position="left">
        {{ field.label }}
      </el-divider>

      <component
        :is="fieldComponent(field.type)"
        v-else-if="fieldComponent(field.type)"
        :field="field"
        :model-value="previewValue"
        disabled
        class="preview"
      />

      <span v-else class="preview__unsupported">
        暂不支持预览：{{ getFieldMeta(field.type).label }}
      </span>
    </div>
  </article>
</template>

<style scoped>
.card {
  padding: 0 10px 6px;
  border: 1px solid var(--fb-border);
  border-radius: 6px;
  background: var(--fb-bg);
  cursor: pointer;
}

.card:hover {
  border-color: #c7ccd4;
}

.card.is-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgb(64 158 255 / 18%);
}

.card__head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
}

.card__icon {
  width: 14px;
  height: 14px;
  color: var(--fb-text-muted);
}

.card__label {
  font-size: 13px;
}

.card__type {
  color: var(--fb-text-muted);
  font-size: 12px;
}

.card__actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.15s;
}

.card:hover .card__actions,
.card.is-selected .card__actions {
  opacity: 1;
}

.card__body {
  padding-bottom: 2px;
}

.preview {
  width: 100%;
}

.preview__unsupported {
  display: block;
  padding: 6px 0;
  color: var(--fb-text-muted);
  font-size: 12px;
}

.subform {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0 4px 12px;
  border-left: 2px dashed var(--fb-border);
}

.subform__empty {
  margin: 4px 0;
  color: var(--fb-text-muted);
  font-size: 12px;
}
</style>
