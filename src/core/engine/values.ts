/**
 * 表单值的初始结构（T09 / T12 共用）
 *
 * 纯函数：只根据 Schema 生成"用户还没填过"的空模型。
 * 与 visibleWhen 无关 —— 隐藏字段也要先占位，否则用户切回可见时 el-form 找不到路径。
 */
import type { FieldNode } from '../schema/types'

/** 单个字段的初始值；没有默认值就返回 undefined（表示"空"，而不是 null） */
export function defaultValueForField(field: FieldNode): unknown {
  if (field.props.defaultValue !== undefined) {
    return structuredClone(field.props.defaultValue)
  }

  switch (field.type) {
    case 'switch':
      return false
    // checkbox 一直按多选组渲染，值必须是数组，否则 el-checkbox-group 会报错
    // upload 提交的是文件名数组，空数组表示还没选文件
    case 'checkbox':
    case 'subform':
    case 'upload':
      return []
    default:
      return undefined
  }
}

/**
 * 子表单一行/整个表单的值对象。
 * divider 只是展示元素，不产生值；subform 初始为空数组（由用户点"添加一行"）。
 */
export function createRowValue(fields: FieldNode[]): Record<string, unknown> {
  const row: Record<string, unknown> = {}

  for (const field of fields) {
    if (field.type === 'divider') continue

    const value = defaultValueForField(field)
    if (value !== undefined) row[field.name] = value
  }

  return row
}

/** 根表单与子表单行结构一致，单独命名让调用处语义清楚 */
export function createFormValue(fields: FieldNode[]): Record<string, unknown> {
  return createRowValue(fields)
}
