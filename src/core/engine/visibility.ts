/**
 * 字段联动与提交值清洗（docs/一期-技术方案.md §2.3、任务清单 T11）
 *
 * visibleWhen 只描述"同级某个字段的值满足条件时显示"，不引入表达式引擎：
 * - 条件求值是纯函数，渲染层和提交层共用同一份实现
 * - 支持级联：B 依赖 A，A 自己隐藏时 B 也视为隐藏
 * - 提交前必须剔除隐藏字段的值，否则"用户看不见的数据进了后端"是真实事故
 */
import type { Condition, FieldNode } from '../schema/types'

/** 空值语义：undefined / null / 空串（含纯空格）/ 空数组；false 与 0 是有效值 */
export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** 对象/数组按结构比较，基本类型按严格相等；避免把 ['a'] 与 ['a'] 误判为不同 */
function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (typeof left !== 'object' || typeof right !== 'object') return false
  if (left === null || right === null) return false

  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch {
    return false
  }
}

/** 单条条件求值；values 是字段所在作用域（根模型或子表单的一行） */
export function evaluateCondition(condition: Condition, values: Record<string, unknown>): boolean {
  const actual = values[condition.field]

  switch (condition.op) {
    case 'eq':
      return valuesEqual(actual, condition.value)
    case 'neq':
      return !valuesEqual(actual, condition.value)
    case 'in':
      // 两边都可能是数组：多选值 in 单值，或单值 in 候选列表
      if (Array.isArray(actual)) {
        return actual.some((item) => valuesEqual(item, condition.value))
      }
      if (Array.isArray(condition.value)) {
        return condition.value.some((item) => valuesEqual(item, actual))
      }
      return false
    case 'empty':
      return isEmptyValue(actual)
    case 'notEmpty':
      return !isEmptyValue(actual)
    default:
      return false
  }
}

/**
 * 判断字段是否可见。
 * fields 必须是"同一作用域"的兄弟字段列表：联动条件按 name 在同级里找依赖源。
 * visiting 用于打断 A→B→A 的循环依赖，环上按已填值直接求值，不死循环。
 */
function isVisibleInner(
  field: FieldNode,
  fields: FieldNode[],
  values: Record<string, unknown>,
  visiting: Set<string>,
): boolean {
  const condition = field.visibleWhen
  if (!condition) return true

  const source = fields.find((item) => item.name === condition.field)
  if (source && source !== field && !visiting.has(source.name)) {
    visiting.add(field.name)
    const sourceVisible = isVisibleInner(source, fields, values, visiting)
    visiting.delete(field.name)
    if (!sourceVisible) return false
  }

  return evaluateCondition(condition, values)
}

export function isFieldVisible(
  field: FieldNode,
  fields: FieldNode[],
  values: Record<string, unknown>,
): boolean {
  return isVisibleInner(field, fields, values, new Set([field.name]))
}

/** 渲染层用：过滤出当前可见字段（顺序不变） */
export function visibleFields(fields: FieldNode[], values: Record<string, unknown>): FieldNode[] {
  return fields.filter((field) => isFieldVisible(field, fields, values))
}

/**
 * 提交前清洗：递归剔除隐藏字段的值。
 * 返回新对象，不修改页面上的 model —— 用户切换条件后原值还能恢复。
 */
export function pruneHiddenValues(
  fields: FieldNode[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data }

  for (const field of fields) {
    if (!isFieldVisible(field, fields, data)) {
      delete result[field.name]
      continue
    }

    if (field.type !== 'subform') continue

    const rows = data[field.name]
    if (!Array.isArray(rows)) continue

    result[field.name] = rows.map((row) => {
      if (typeof row !== 'object' || row === null) return row
      return pruneHiddenValues(field.children ?? [], row as Record<string, unknown>)
    })
  }

  return result
}
