<script setup lang="ts">
/**
 * 属性面板（T18 基础 / T19 选项、校验、联动）
 *
 * 输入不直接写 store：每敲一个字就 commit 会把历史打满（技术方案 §6）。
 * 这里用本地草稿 + 300ms debounce，切字段 / 卸载前先 flush，
 * 保证"改完没等 300ms 就点了别的字段"也不会丢改动。
 *
 * 草稿里只放可序列化数据，applied 存上一次写入时的草稿副本：
 * 非法输入（坏正则、重复选项、不完整联动）不写进 schema，但仍然记入 applied，
 * 避免 300ms 后反复重试同一次无效提交。
 */
import { computed, onBeforeUnmount, reactive, ref, toRaw, watch } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import { getFieldMeta } from '@/core/meta/field-meta'
import type { Condition, FieldNode, FieldOption, Rule } from '@/core/schema/types'
import { useDesignerStore } from '@/stores/designer'

const props = defineProps<{
  field: FieldNode | null
}>()

const store = useDesignerStore()

/** 与 docs/一期-技术方案.md §6 保持一致 */
const COMMIT_DELAY = 300

const activeTab = ref('basic')

/** 联动可选的比较方式；label 直接给用户看 */
const CONDITION_OPS: { value: Condition['op']; label: string }[] = [
  { value: 'eq', label: '等于' },
  { value: 'neq', label: '不等于' },
  { value: 'in', label: '包含' },
  { value: 'empty', label: '为空' },
  { value: 'notEmpty', label: '不为空' },
]

interface RuleState {
  required: { enabled: boolean; message: string }
  pattern: { enabled: boolean; value: string; message: string }
  range: { enabled: boolean; min: number | null; max: number | null; message: string }
  len: { enabled: boolean; min: number | null; max: number | null; message: string }
}

interface ConditionState {
  enabled: boolean
  field: string
  op: Condition['op']
  /** 类型跟随依赖字段：开关是 boolean，数字是 number，其余是 string */
  value: string | number | boolean | null
}

interface Draft {
  label: string
  name: string
  placeholder: string
  span: number
  multiple: boolean
  options: FieldOption[]
  rules: RuleState
  condition: ConditionState
}

/** 与当前字段的差异；undefined 表示不改，null 表示删除可选字段 */
interface FieldPatch {
  label?: string
  name?: string
  placeholder?: string | null
  options?: FieldOption[]
  multiple?: boolean
  rules?: Rule[]
  condition?: Condition | null
}

function emptyRuleState(): RuleState {
  return {
    required: { enabled: false, message: '' },
    pattern: { enabled: false, value: '', message: '' },
    range: { enabled: false, min: null, max: null, message: '' },
    len: { enabled: false, min: null, max: null, message: '' },
  }
}

function emptyDraft(): Draft {
  return {
    label: '',
    name: '',
    placeholder: '',
    span: 1,
    multiple: false,
    options: [],
    rules: emptyRuleState(),
    condition: { enabled: false, field: '', op: 'eq', value: null },
  }
}

const draft = reactive<Draft>(emptyDraft())
/** 上一次真正写进 schema 的草稿副本；与 draft 相同就不再 commit */
let applied: Draft = emptyDraft()
/** 草稿属于哪个字段：flush 时 props.field 可能已经切走，不能再读它 */
let draftFieldId: string | null = null

const meta = computed(() => (props.field ? getFieldMeta(props.field.type) : null))
const supportsPlaceholder = computed(
  () => meta.value?.props.some((item) => item.key === 'placeholder') ?? false,
)
const supportsOptions = computed(
  () => meta.value?.props.some((item) => item.key === 'options') ?? false,
)
const supportsMultiple = computed(() => props.field?.type === 'select')
const supportsRequired = computed(() => meta.value?.rules.includes('required') ?? false)

/** 同级字段：联动条件的依赖源只能来自同一作用域 */
const siblings = computed(() => (props.field ? store.siblingsOf(props.field.id) : []))
const dependencyFields = computed(() =>
  siblings.value.filter((item) => item.id !== props.field?.id && item.type !== 'divider'),
)
const dependencyField = computed(() =>
  siblings.value.find((item) => item.name === draft.condition.field),
)
/** 比较值控件按依赖字段的类型切换，避免把开关的 true 存成字符串 "true" */
const conditionValueKind = computed<'boolean' | 'number' | 'options' | 'text'>(() => {
  const type = dependencyField.value?.type
  if (type === 'switch') return 'boolean'
  if (type === 'number') return 'number'
  if (type === 'select' || type === 'radio' || type === 'checkbox') return 'options'
  return 'text'
})
const dependencyOptions = computed(() => dependencyField.value?.props.options ?? [])
const needsConditionValue = computed(
  () => draft.condition.op !== 'empty' && draft.condition.op !== 'notEmpty',
)
const conditionText = computed(() => {
  const value = draft.condition.value
  if (value === null) return ''
  return typeof value === 'string' ? value : String(value)
})

const optionsIssue = computed(() => {
  if (!supportsOptions.value) return ''
  const list = draft.options
  if (list.length === 0) return '至少保留一项'
  if (list.some((option) => !option.label.trim())) return '选项文字不能为空'
  const values = list.map((option) => option.value.trim())
  if (values.some((value) => !value)) return '选项值不能为空'
  const duplicate = values.find((value, index) => values.indexOf(value) !== index)
  return duplicate ? `选项值重复：${duplicate}` : ''
})

const patternError = computed(() => {
  const pattern = draft.rules.pattern
  if (!pattern.enabled) return ''
  if (!pattern.value.trim()) return '请填写正则表达式'
  if (!isValidPattern(pattern.value)) return '正则不合法，未写入'
  return ''
})

const rangeError = computed(() => (draft.rules.range.enabled ? boundIssue(draft.rules.range) : ''))
const lenError = computed(() => (draft.rules.len.enabled ? boundIssue(draft.rules.len) : ''))

const conditionIssue = computed(() => {
  const condition = draft.condition
  if (!condition.enabled) return ''
  if (!condition.field) return '请选择依赖字段'
  if (!dependencyField.value) return '同级找不到该字段'
  if (needsConditionValue.value && isEmptyConditionValue(condition.value)) return '请填写比较值'
  return ''
})

function boundIssue(state: { min: number | null; max: number | null }): string {
  if (state.min === null && state.max === null) return '至少填写一个边界'
  if (state.min !== null && state.max !== null && state.min > state.max) {
    return '最小值不能大于最大值'
  }
  return ''
}

function isValidPattern(value: string): boolean {
  if (!value.trim()) return false
  try {
    new RegExp(value)
    return true
  } catch {
    return false
  }
}

function isEmptyConditionValue(value: string | number | boolean | null): boolean {
  if (value === null) return true
  return typeof value === 'string' && value.trim() === ''
}

/** Schema 里的 value 是 unknown（导入的 JSON 不可信），收敛成控件能吃的三种基本类型 */
function normalizeConditionValue(value: unknown): string | number | boolean | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  return null
}

function supportsRule(type: Rule['type']): boolean {
  return meta.value?.rules.includes(type) ?? false
}

function supportsPlaceholderFor(field: FieldNode): boolean {
  return getFieldMeta(field.type).props.some((item) => item.key === 'placeholder')
}

function supportsOptionsFor(field: FieldNode): boolean {
  return getFieldMeta(field.type).props.some((item) => item.key === 'options')
}

function readDraft(field: FieldNode): Draft {
  const rules = emptyRuleState()
  for (const rule of field.rules) {
    if (rule.type === 'required') {
      rules.required = { enabled: true, message: rule.message ?? '' }
    } else if (rule.type === 'pattern') {
      rules.pattern = { enabled: true, value: rule.value, message: rule.message ?? '' }
    } else if (rule.type === 'range') {
      rules.range = {
        enabled: true,
        min: rule.min ?? null,
        max: rule.max ?? null,
        message: rule.message ?? '',
      }
    } else if (rule.type === 'len') {
      rules.len = {
        enabled: true,
        min: rule.min ?? null,
        max: rule.max ?? null,
        message: rule.message ?? '',
      }
    }
  }

  const condition = field.visibleWhen

  return {
    label: field.label,
    name: field.name,
    placeholder: field.props.placeholder ?? '',
    span: field.layout?.span ?? 1,
    multiple: field.props.multiple === true,
    options: (field.props.options ?? []).map((option) => ({ ...option })),
    rules,
    condition: {
      enabled: Boolean(condition),
      field: condition?.field ?? '',
      op: condition?.op ?? 'eq',
      value: normalizeConditionValue(condition?.value),
    },
  }
}

function cloneDraft(source: Draft): Draft {
  return structuredClone(toRaw(source))
}

function buildRules(field: FieldNode, state: RuleState): Rule[] {
  const allowed = getFieldMeta(field.type).rules
  const result: Rule[] = []

  if (allowed.includes('required') && state.required.enabled) {
    const message = state.required.message.trim()
    result.push(message ? { type: 'required', message } : { type: 'required' })
  }

  if (allowed.includes('pattern')) {
    const { enabled, value, message } = state.pattern
    if (enabled && isValidPattern(value)) {
      const text = message.trim()
      result.push(text ? { type: 'pattern', value, message: text } : { type: 'pattern', value })
    } else if (enabled) {
      // 非法正则不落库：保留上一次有效规则，避免一次误输入把已有校验删掉
      const previous = field.rules.find((rule) => rule.type === 'pattern')
      if (previous) result.push(previous)
    }
  }

  if (allowed.includes('range')) {
    const { enabled, min, max, message } = state.range
    if (enabled && (min !== null || max !== null)) {
      result.push(boundRule('range', min, max, message))
    } else if (enabled) {
      const previous = field.rules.find((rule) => rule.type === 'range')
      if (previous) result.push(previous)
    }
  }

  if (allowed.includes('len')) {
    const { enabled, min, max, message } = state.len
    if (enabled && (min !== null || max !== null)) {
      result.push(boundRule('len', min, max, message))
    } else if (enabled) {
      const previous = field.rules.find((rule) => rule.type === 'len')
      if (previous) result.push(previous)
    }
  }

  // 该类型不支持的规则（导入的异常 Schema 可能有）原样保留，不因为打开面板就丢数据
  const preserved = field.rules.filter((rule) => !allowed.includes(rule.type))
  return [...result, ...preserved]
}

function boundRule(
  type: 'range' | 'len',
  min: number | null,
  max: number | null,
  message: string,
): Rule {
  const text = message.trim()
  if (type === 'range') {
    return {
      type: 'range',
      ...(min !== null ? { min } : {}),
      ...(max !== null ? { max } : {}),
      ...(text ? { message: text } : {}),
    }
  }
  return {
    type: 'len',
    ...(min !== null ? { min } : {}),
    ...(max !== null ? { max } : {}),
    ...(text ? { message: text } : {}),
  }
}

function buildCondition(state: ConditionState): Condition | undefined {
  if (!state.field || !dependencyField.value) return undefined
  if (needsConditionValue.value) {
    if (isEmptyConditionValue(state.value)) return undefined
    return { field: state.field, op: state.op, value: state.value }
  }
  return { field: state.field, op: state.op }
}

function optionsValid(options: FieldOption[]): boolean {
  if (options.length === 0) return false
  if (options.some((option) => !option.label.trim())) return false
  const values = options.map((option) => option.value.trim())
  if (values.some((value) => !value)) return false
  return new Set(values).size === values.length
}

/**
 * 草稿 → 差异。
 * 非法部分（重复选项、坏正则、不完整联动）直接跳过，
 * 这样它们既不会写进 schema，也不会因为"调了 updateField"而压一条空历史。
 */
function buildPatch(field: FieldNode, next: Draft): FieldPatch {
  const patch: FieldPatch = {}

  const label = next.label.trim()
  if (label !== field.label) patch.label = label

  const name = next.name.trim()
  if (name !== field.name) patch.name = name

  if (supportsPlaceholderFor(field)) {
    const placeholder = next.placeholder
    if (placeholder !== (field.props.placeholder ?? '')) patch.placeholder = placeholder || null
  }

  if (supportsOptionsFor(field)) {
    if (optionsValid(next.options)) {
      const sanitized = next.options.map((option) => ({
        label: option.label.trim(),
        value: option.value.trim(),
      }))
      if (JSON.stringify(sanitized) !== JSON.stringify(field.props.options ?? [])) {
        patch.options = sanitized
      }
    }
    if (field.type === 'select' && field.props.multiple !== next.multiple) {
      patch.multiple = next.multiple
    }
  }

  const rules = buildRules(field, next.rules)
  if (JSON.stringify(rules) !== JSON.stringify(field.rules)) patch.rules = rules

  if (next.condition.enabled) {
    const condition = buildCondition(next.condition)
    if (condition && JSON.stringify(condition) !== JSON.stringify(field.visibleWhen ?? null)) {
      patch.condition = condition
    }
  } else if (field.visibleWhen) {
    patch.condition = null
  }

  return patch
}

let timer: ReturnType<typeof setTimeout> | undefined

function flush(): void {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }

  const id = draftFieldId
  if (!id) return
  if (JSON.stringify(draft) === JSON.stringify(applied)) return

  const current = store.fieldById(id)
  if (!current) return

  const next = cloneDraft(draft)
  const patch = buildPatch(current, next)
  applied = next
  if (Object.keys(patch).length === 0) return

  store.updateField(id, (field) => {
    if (patch.label !== undefined) field.label = patch.label
    if (patch.name !== undefined) field.name = patch.name

    if (patch.placeholder !== undefined) {
      if (patch.placeholder === null) delete field.props.placeholder
      else field.props.placeholder = patch.placeholder
    }

    if (patch.options) field.props.options = patch.options
    if (patch.multiple !== undefined) field.props.multiple = patch.multiple
    if (patch.rules) field.rules = patch.rules

    if (patch.condition !== undefined) {
      if (patch.condition === null) delete field.visibleWhen
      else field.visibleWhen = patch.condition
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

function setConditionValue(value: unknown): void {
  draft.condition.value = normalizeConditionValue(value)
  schedule()
}

function resetConditionValue(): void {
  draft.condition.value = null
  schedule()
}

function addOption(): void {
  const used = new Set(draft.options.map((option) => option.value.trim()))
  let index = draft.options.length + 1
  while (used.has(`option${index}`)) index += 1
  draft.options.push({ label: `选项${index}`, value: `option${index}` })
  schedule()
}

function removeOption(index: number): void {
  if (draft.options.length <= 1) return
  draft.options.splice(index, 1)
  schedule()
}

// 只在"换字段"时重载草稿：面板自己写 store 不会换节点引用，不会打断输入
watch(
  () => props.field,
  (field) => {
    flush()
    draftFieldId = field?.id ?? null
    const next = field ? readDraft(field) : emptyDraft()
    Object.assign(draft, next)
    applied = cloneDraft(next)
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
            <el-switch v-model="draft.rules.required.enabled" @change="schedule" />
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
        <el-empty v-if="!supportsOptions" :image-size="40" description="该字段没有选项" />

        <el-form v-else label-position="top" size="small">
          <el-form-item v-if="supportsMultiple" label="允许多选">
            <el-switch v-model="draft.multiple" @change="schedule" />
          </el-form-item>

          <el-form-item label="选项">
            <div class="options">
              <div v-for="(option, index) in draft.options" :key="index" class="option">
                <el-input v-model="option.label" placeholder="显示文字" @input="schedule" />
                <el-input v-model="option.value" class="mono" placeholder="值" @input="schedule" />
                <el-button
                  text
                  :icon="Delete"
                  :disabled="draft.options.length <= 1"
                  aria-label="删除选项"
                  @click="removeOption(index)"
                />
              </div>
            </div>

            <el-button text :icon="Plus" @click="addOption">添加选项</el-button>
            <p v-if="optionsIssue" class="hint hint--error">{{ optionsIssue }}</p>
            <p v-else class="hint">选项值同级唯一，作为提交数据的值</p>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="校验" name="rules">
        <el-empty
          v-if="!meta || meta.rules.length === 0"
          :image-size="40"
          description="该字段不支持校验"
        />

        <el-form v-else label-position="top" size="small">
          <template v-if="supportsRule('required')">
            <el-form-item label="必填">
              <el-switch v-model="draft.rules.required.enabled" @change="schedule" />
            </el-form-item>
            <el-form-item v-if="draft.rules.required.enabled" label="必填提示">
              <el-input
                v-model="draft.rules.required.message"
                placeholder="留空使用默认提示"
                @input="schedule"
              />
            </el-form-item>
          </template>

          <template v-if="supportsRule('pattern')">
            <el-form-item label="正则校验">
              <el-switch v-model="draft.rules.pattern.enabled" @change="schedule" />
            </el-form-item>
            <el-form-item v-if="draft.rules.pattern.enabled" label="正则表达式">
              <el-input
                v-model="draft.rules.pattern.value"
                class="mono"
                placeholder="^\d{11}$"
                @input="schedule"
              />
              <p v-if="patternError" class="hint hint--error">{{ patternError }}</p>
            </el-form-item>
            <el-form-item v-if="draft.rules.pattern.enabled" label="校验提示">
              <el-input
                v-model="draft.rules.pattern.message"
                placeholder="留空使用默认提示"
                @input="schedule"
              />
            </el-form-item>
          </template>

          <template v-if="supportsRule('range')">
            <el-form-item label="数值范围">
              <el-switch v-model="draft.rules.range.enabled" @change="schedule" />
            </el-form-item>
            <template v-if="draft.rules.range.enabled">
              <el-form-item label="最小值 / 最大值">
                <div class="pair">
                  <el-input-number
                    v-model="draft.rules.range.min"
                    :controls="false"
                    placeholder="不限"
                    @change="schedule"
                  />
                  <el-input-number
                    v-model="draft.rules.range.max"
                    :controls="false"
                    placeholder="不限"
                    @change="schedule"
                  />
                </div>
                <p v-if="rangeError" class="hint hint--error">{{ rangeError }}</p>
              </el-form-item>
              <el-form-item label="校验提示">
                <el-input
                  v-model="draft.rules.range.message"
                  placeholder="留空使用默认提示"
                  @input="schedule"
                />
              </el-form-item>
            </template>
          </template>

          <template v-if="supportsRule('len')">
            <el-form-item label="长度范围">
              <el-switch v-model="draft.rules.len.enabled" @change="schedule" />
            </el-form-item>
            <template v-if="draft.rules.len.enabled">
              <el-form-item label="最少 / 最多字数">
                <div class="pair">
                  <el-input-number
                    v-model="draft.rules.len.min"
                    :controls="false"
                    placeholder="不限"
                    @change="schedule"
                  />
                  <el-input-number
                    v-model="draft.rules.len.max"
                    :controls="false"
                    placeholder="不限"
                    @change="schedule"
                  />
                </div>
                <p v-if="lenError" class="hint hint--error">{{ lenError }}</p>
              </el-form-item>
              <el-form-item label="校验提示">
                <el-input
                  v-model="draft.rules.len.message"
                  placeholder="留空使用默认提示"
                  @input="schedule"
                />
              </el-form-item>
            </template>
          </template>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="联动" name="linkage">
        <el-form label-position="top" size="small">
          <el-form-item label="启用联动">
            <el-switch v-model="draft.condition.enabled" @change="schedule" />
          </el-form-item>

          <template v-if="draft.condition.enabled">
            <el-form-item label="依赖字段">
              <el-select
                v-model="draft.condition.field"
                filterable
                allow-create
                default-first-option
                placeholder="同级字段"
                @change="resetConditionValue"
              >
                <el-option
                  v-for="item in dependencyFields"
                  :key="item.id"
                  :label="`${item.label}（${item.name}）`"
                  :value="item.name"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="条件">
              <el-select v-model="draft.condition.op" @change="schedule">
                <el-option
                  v-for="op in CONDITION_OPS"
                  :key="op.value"
                  :label="op.label"
                  :value="op.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item v-if="needsConditionValue" label="比较值">
              <el-select
                v-if="conditionValueKind === 'boolean'"
                :model-value="draft.condition.value"
                @update:model-value="setConditionValue"
              >
                <el-option label="是" :value="true" />
                <el-option label="否" :value="false" />
              </el-select>

              <el-select
                v-else-if="conditionValueKind === 'options'"
                :model-value="draft.condition.value"
                @update:model-value="setConditionValue"
              >
                <el-option
                  v-for="option in dependencyOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>

              <el-input-number
                v-else-if="conditionValueKind === 'number'"
                :model-value="
                  typeof draft.condition.value === 'number' ? draft.condition.value : undefined
                "
                :controls="false"
                @update:model-value="setConditionValue"
              />

              <el-input
                v-else
                :model-value="conditionText"
                placeholder="依赖字段的值"
                @update:model-value="setConditionValue"
              />
            </el-form-item>

            <p v-if="conditionIssue" class="hint hint--error">{{ conditionIssue }}</p>
            <p class="hint">按同级字段的 name 匹配；关掉联动会删除该配置</p>
          </template>
        </el-form>
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

.hint--error {
  color: #f56c6c;
}

.meta {
  color: var(--fb-text-muted);
  font-size: 12px;
}

.mono,
.mono :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.option {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
}

.pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
}

.pair :deep(.el-input-number) {
  width: 100%;
}
</style>
