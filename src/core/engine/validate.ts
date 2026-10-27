/**
 * 校验规则适配（docs/一期-技术方案.md §2.4、任务清单 T10）
 *
 * Schema 里的 Rule[] 是可序列化数据，这里把它翻译成 async-validator（Element Plus 内置）认识的规则对象。
 * 关键点：
 * - 规则只在渲染层使用，不写回 Schema，保证导入导出永远是纯 JSON
 * - 空值判定按"字段类型"区分：checkbox 的多选值必须是数组，required 才判得出空
 * - 非法正则直接跳过而不是抛错，坏 Schema 不应该让整页白屏
 */
import type { FieldNode, FieldType, Rule } from '../schema/types'

/** async-validator 规则的最小子集；Element Plus 的 FormItemRule 结构兼容它 */
export interface FormRule {
  required?: boolean
  pattern?: RegExp
  type?: 'string' | 'number' | 'array'
  min?: number
  max?: number
  /** required 时把纯空格也算空值 */
  whitespace?: boolean
  message: string
  trigger?: 'blur' | 'change'
}

/** 值变化就该校验的控件：选择类没有"失焦"语义 */
const CHANGE_TRIGGER_TYPES: readonly FieldType[] = [
  'select',
  'radio',
  'checkbox',
  'switch',
  'date',
  'upload',
  'subform',
]

function triggerOf(type: FieldType): 'blur' | 'change' {
  return CHANGE_TRIGGER_TYPES.includes(type) ? 'change' : 'blur'
}

/** 值是数组的字段：required 必须带 type: 'array'，否则空数组会被判为"已填" */
function isArrayValue(field: FieldNode): boolean {
  if (field.type === 'checkbox' || field.type === 'subform') return true
  return field.type === 'select' && field.props.multiple === true
}

function requiredMessage(field: FieldNode): string {
  switch (field.type) {
    case 'select':
    case 'radio':
    case 'checkbox':
    case 'date':
      return `请选择${field.label}`
    case 'switch':
      return `请开启${field.label}`
    case 'upload':
      return `请上传${field.label}`
    default:
      return `请输入${field.label}`
  }
}

function rangeText(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return `${min} ~ ${max}`
  if (min !== undefined) return `不小于 ${min}`
  return `不大于 ${max}`
}

/** 单条 Rule → 0 或 1 条 async-validator 规则 */
function toValidatorRule(field: FieldNode, rule: Rule): FormRule | null {
  const trigger = triggerOf(field.type)

  switch (rule.type) {
    case 'required': {
      const arrayValue = isArrayValue(field)
      return {
        required: true,
        ...(arrayValue ? { type: 'array' as const } : {}),
        // 文本类把纯空格也算空，否则"填一个空格"能绕过必填
        ...(field.type === 'input' || field.type === 'textarea' ? { whitespace: true } : {}),
        message: rule.message ?? requiredMessage(field),
        trigger,
      }
    }

    case 'pattern': {
      let pattern: RegExp
      try {
        pattern = new RegExp(rule.value)
      } catch {
        // 非法正则属于 Schema 数据错误，交给 T19 的属性面板提示；渲染层不能因此崩掉
        return null
      }
      return {
        pattern,
        message: rule.message ?? `${field.label}格式不正确`,
        trigger,
      }
    }

    case 'range': {
      if (rule.min === undefined && rule.max === undefined) return null
      return {
        // number 字段的 min/max 比较数值；其他类型这里不生效，range 只给 number 用
        type: 'number',
        min: rule.min,
        max: rule.max,
        message: rule.message ?? `${field.label}需在 ${rangeText(rule.min, rule.max)} 之间`,
        trigger,
      }
    }

    case 'len': {
      if (rule.min === undefined && rule.max === undefined) return null
      return {
        min: rule.min,
        max: rule.max,
        message: rule.message ?? `${field.label}长度需在 ${rangeText(rule.min, rule.max)} 之间`,
        trigger,
      }
    }

    default:
      return null
  }
}

/** 一个字段的全部规则；divider 不参与校验 */
export function buildFieldRules(field: FieldNode): FormRule[] {
  if (field.type === 'divider') return []

  return field.rules
    .map((rule) => toValidatorRule(field, rule))
    .filter((rule): rule is FormRule => rule !== null)
}

/**
 * 生成 el-form 的 rules 映射，key 是 el-form-item 的 prop 完整路径。
 *
 * 子表单的行是动态数组，所以要把当前 model 里的行也走一遍：
 * handover.0.item / handover.1.item ... 都生成规则，validate() 才能连子字段一起校验。
 */
export function buildFormRules(
  fields: FieldNode[],
  model: Record<string, unknown>,
  pathPrefix = '',
): Record<string, FormRule[]> {
  const result: Record<string, FormRule[]> = {}

  for (const field of fields) {
    if (field.type === 'divider') continue

    const path = pathPrefix ? `${pathPrefix}.${field.name}` : field.name
    const rules = buildFieldRules(field)
    if (rules.length > 0) result[path] = rules

    if (field.type !== 'subform') continue

    const rows = model[field.name]
    if (!Array.isArray(rows)) continue

    rows.forEach((row, index) => {
      if (typeof row !== 'object' || row === null) return
      Object.assign(
        result,
        buildFormRules(field.children ?? [], row as Record<string, unknown>, `${path}.${index}`),
      )
    })
  }

  return result
}
