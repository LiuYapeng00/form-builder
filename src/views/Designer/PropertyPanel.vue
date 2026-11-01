<script setup lang="ts">
/**
 * 属性面板（T18 基础 tab）
 *
 * 输入不直接写 store：每敲一个字就 commit 会把历史打满（技术方案 §6）。
 * 这里用本地草稿 + 300ms debounce，切字段 / 卸载前先 flush，
 * 保证"改完没等 300ms 就点了别的字段"也不会丢改动。
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { getFieldMeta } from '@/core/meta/field-meta'
import type { FieldNode } from '@/core/schema/types'
import { useDesignerStore } from '@/stores/designer'

const props = defineProps<{
  field: FieldNode | null
}>()

const store = useDesignerStore()

/** 与 docs/一期-技术方案.md §6 保持一致 */
const COMMIT_DELAY = 300

const activeTab = ref('basic')

interface Draft {
  label: string
  name: string
  placeholder: string
  required: boolean
  span: number
}

const EMPTY_DRAFT: Draft = { label: '', name: '', placeholder: '', required: false, span: 1 }

const draft = reactive<Draft>({ ...EMPTY_DRAFT })
/** 上一次真正写进 schema 的值；与 draft 相同就不再 commit，避免空历史 */
let applied: Draft = { ...EMPTY_DRAFT }
/** 草稿属于哪个字段：flush 时 props.field 可能已经切走，不能再读它 */
let draftFieldId: string | null = null

const meta = computed(() => (props.field ? getFieldMeta(props.field.type) : null))
const supportsPlaceholder = computed(
  () => meta.value?.props.some((item) => item.key === 'placeholder') ?? false,
)
const supportsRequired = computed(() => meta.value?.rules.includes('required') ?? false)

function readDraft(field: FieldNode): Draft {
  return {
    label: field.label,
    name: field.name,
    placeholder: field.props.placeholder ?? '',
    required: field.rules.some((rule) => rule.type === 'required'),
    span: field.layout?.span ?? 1,
  }
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.label === b.label &&
    a.name === b.name &&
    a.placeholder === b.placeholder &&
    a.required === b.required &&
    a.span === b.span
  )
}

function supportsPlaceholderFor(field: FieldNode): boolean {
  return getFieldMeta(field.type).props.some((item) => item.key === 'placeholder')
}

let timer: ReturnType<typeof setTimeout> | undefined

function flush(): void {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }

  const id = draftFieldId
  if (!id || sameDraft(draft, applied)) return

  const next: Draft = { ...draft }
  const prev = applied
  applied = next

  store.updateField(id, (field) => {
    if (next.label !== prev.label) field.label = next.label.trim()
    if (next.name !== prev.name) field.name = next.name.trim()

    // 不同字段类型支持的 props 不同，按字段自己的 meta 判断，别用面板当前的 computed
    if (next.placeholder !== prev.placeholder && supportsPlaceholderFor(field)) {
      if (next.placeholder) field.props.placeholder = next.placeholder
      else delete field.props.placeholder
    }

    if (next.required !== prev.required && getFieldMeta(field.type).rules.includes('required')) {
      const rest = field.rules.filter((rule) => rule.type !== 'required')
      field.rules = next.required ? [...rest, { type: 'required' }] : rest
    }

    if (next.span !== prev.span) {
      // span=1 等于没设置，删掉可选字段，导出的 JSON 更干净
      if (next.span <= 1) delete field.layout
      else field.layout = { span: next.span }
    }
  })
}

function schedule(): void {
  if (timer !== undefined) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = undefined
    flush()
  }, COMMIT_DELAY)
}

// 只在"换字段"时重载草稿：面板自己写 store 不会换节点引用，不会打断输入
watch(
  () => props.field,
  (field) => {
    flush()
    draftFieldId = field?.id ?? null
    const next = field ? readDraft(field) : { ...EMPTY_DRAFT }
    Object.assign(draft, next)
    applied = { ...next }
    activeTab.value = 'basic'
  },
  { immediate: true },
)

onBeforeUnmount(flush)
</script>

<template>
  <aside class="panel">
    <h2 class="panel__title">属性</h2>

    <el-empty v-if="!field" :image-size="48" description="未选中字段" />

    <el-tabs v-else v-model="activeTab" class="panel__tabs">
      <el-tab-pane label="基础" name="basic">
        <el-form label-position="top" size="small">
          <el-form-item label="标题">
            <el-input v-model="draft.label" placeholder="字段标题" @input="schedule" />
          </el-form-item>

          <el-form-item label="字段名">
            <el-input
              v-model="draft.name"
              class="mono"
              placeholder="提交时的 key"
              @input="schedule"
            />
            <p class="hint">同级唯一，作为提交数据的 key</p>
          </el-form-item>

          <el-form-item v-if="supportsPlaceholder" label="占位提示">
            <el-input v-model="draft.placeholder" placeholder="请输入" @input="schedule" />
          </el-form-item>

          <el-form-item v-if="supportsRequired" label="必填">
            <el-switch v-model="draft.required" @change="schedule" />
          </el-form-item>

          <el-form-item label="跨列数">
            <el-input-number v-model="draft.span" :min="1" :max="4" :step="1" @change="schedule" />
            <p class="hint">栅格布局下占几列，单列布局无影响</p>
          </el-form-item>

          <el-form-item label="类型 / ID">
            <span class="meta">
              {{ meta?.label }} · <span class="mono">{{ field.id }}</span>
            </span>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="选项" name="options">
        <el-empty :image-size="40" description="选项编辑在 T19 接入" />
      </el-tab-pane>

      <el-tab-pane label="校验" name="rules">
        <el-empty :image-size="40" description="校验规则在 T19 接入" />
      </el-tab-pane>

      <el-tab-pane label="联动" name="linkage">
        <el-empty :image-size="40" description="字段联动在 T19 接入" />
      </el-tab-pane>
    </el-tabs>
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

.panel__tabs {
  min-height: 0;
}

.hint {
  margin: 4px 0 0;
  color: var(--fb-text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.meta {
  color: var(--fb-text-muted);
  font-size: 12px;
}

.mono,
.mono :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
</style>
