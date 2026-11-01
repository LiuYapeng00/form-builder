<script setup lang="ts">
/**
 * 递归表单渲染（T09）
 *
 * 只做三件事：按布局排字段、把 subform 递归成"对象数组"、维护行的增删。
 * 校验上下文由外层 el-form 提供 —— 这里不新建 el-form，
 * 否则子表单的校验会脱离根表单，提交时拿不到子字段错误。
 */
import { computed } from 'vue'
import type { FieldNode, FormLayout } from '@/core/schema/types'
import { createRowValue } from '@/core/engine/values'
import { visibleFields } from '@/core/engine/visibility'
import FieldRenderer from './FieldRenderer.vue'

const props = withDefaults(
  defineProps<{
    fields: FieldNode[]
    /** 当前作用域的值对象：根表单是根模型，子表单行是行对象 */
    model: Record<string, unknown>
    layout?: FormLayout
    /** el-form-item 的完整路径前缀，根为空，子表单行是 employees.0 */
    pathPrefix?: string
    designMode?: boolean
    depth?: number
  }>(),
  {
    layout: () => ({ type: 'single' as const }),
    pathPrefix: '',
    designMode: false,
    depth: 0,
  },
)

const columns = computed(() =>
  props.layout.type === 'grid' ? Math.max(1, props.layout.columns ?? 2) : 1,
)

/**
 * 作用域对象由调用方传入且整棵生命周期内不替换（根模型 / 子表单行对象），
 * 这里缓存引用后只改它的内容，避免 ESLint 把"改嵌套值"误判成"改 prop"。
 */
const scope = props.model

/** 按 visibleWhen 过滤；子表单每行是独立作用域，所以递归时会自动逐行求值 */
const shownFields = computed(() => visibleFields(props.fields, scope))

/** 单列布局一格占满；栅格布局按总列数均分，字段可用 layout.span 跨列 */
function colSpan(field: FieldNode): number {
  if (props.layout.type !== 'grid') return 24
  const base = Math.floor(24 / columns.value)
  const factor = Math.min(Math.max(1, field.layout?.span ?? 1), columns.value)
  return base * factor
}

function fieldPath(field: FieldNode): string {
  return props.pathPrefix ? `${props.pathPrefix}.${field.name}` : field.name
}

function rowPath(field: FieldNode, index: number): string {
  return `${fieldPath(field)}.${index}`
}

/** 子表单值必须是对象数组；脏数据（被导入的坏 JSON）降级成空数组而不是崩掉渲染 */
function rowsOf(field: FieldNode): Record<string, unknown>[] {
  const value = scope[field.name]
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}

function ensureRows(field: FieldNode): Record<string, unknown>[] {
  const value = scope[field.name]
  if (Array.isArray(value)) return value as Record<string, unknown>[]

  const rows: Record<string, unknown>[] = []
  scope[field.name] = rows
  return rows
}

function addRow(field: FieldNode): void {
  ensureRows(field).push(createRowValue(field.children ?? []))
}

function removeRow(field: FieldNode, index: number): void {
  ensureRows(field).splice(index, 1)
}

function setFieldValue(field: FieldNode, value: unknown): void {
  scope[field.name] = value
}
</script>

<template>
  <el-row :gutter="16">
    <el-col v-for="field in shownFields" :key="field.id" :span="colSpan(field)">
      <!-- subform：标题 + 行列表，行内字段继续递归 -->
      <section v-if="field.type === 'subform'" class="fb-subform">
        <header class="fb-subform__head">
          <span class="fb-subform__title">{{ field.label }}</span>
          <el-button v-if="!designMode" size="small" @click="addRow(field)">添加一行</el-button>
        </header>

        <div v-for="(row, index) in rowsOf(field)" :key="index" class="fb-subform__row">
          <header class="fb-subform__row-head">
            <span>{{ field.label }} {{ index + 1 }}</span>
            <el-button
              v-if="!designMode"
              link
              type="danger"
              size="small"
              @click="removeRow(field, index)"
            >
              删除
            </el-button>
          </header>

          <RecursiveForm
            :fields="field.children ?? []"
            :model="row"
            :layout="{ type: 'grid', columns: field.props.columns ?? 1 }"
            :path-prefix="rowPath(field, index)"
            :design-mode="designMode"
            :depth="depth + 1"
          />
        </div>

        <el-empty
          v-if="rowsOf(field).length === 0"
          :image-size="48"
          description="暂无数据，点击「添加一行」"
        />
      </section>

      <FieldRenderer
        v-else
        :field="field"
        :path="fieldPath(field)"
        :model-value="model[field.name]"
        :design-mode="designMode"
        @update:model-value="setFieldValue(field, $event)"
      />
    </el-col>
  </el-row>
</template>

<style scoped>
.fb-subform {
  margin-bottom: 18px;
  padding: 12px 14px;
  border: 1px solid var(--fb-border);
  border-radius: 8px;
  background: var(--fb-bg-muted);
}

.fb-subform__head,
.fb-subform__row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.fb-subform__head {
  margin-bottom: 8px;
}

.fb-subform__title {
  font-size: 14px;
  font-weight: 600;
}

.fb-subform__row {
  margin-top: 8px;
  padding: 10px 12px 0;
  border: 1px dashed var(--fb-border);
  border-radius: 6px;
  background: var(--fb-bg);
}

.fb-subform__row-head {
  margin-bottom: 4px;
  color: var(--fb-text-muted);
  font-size: 12px;
}

/* ≤768px 强制单列：el-col 的 span 是行内宽度，媒体查询只能靠 CSS 覆盖 */
@media (max-width: 768px) {
  :deep(.el-col) {
    flex: 0 0 100%;
    max-width: 100%;
  }
}
</style>
