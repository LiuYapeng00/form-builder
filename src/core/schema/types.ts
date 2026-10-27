/**
 * Form Builder Schema 定义（唯一真源：docs/一期-技术方案.md §2.2）
 *
 * 硬约束：本目录只允许纯 TypeScript，禁止 import vue / pinia / element-plus。
 * 目的：二期用 Next.js + React 重写时，core 可以整目录搬过去，只换 UI 层。
 */

/** 一期支持的字段类型（10 种输入 + 1 种纯展示） */
export const FIELD_TYPES = [
  'input',
  'textarea',
  'number',
  'select',
  'radio',
  'checkbox',
  'switch',
  'date',
  'upload',
  'subform',
  'divider',
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

/** 布局模式：单列 / 栅格 / 分步 */
export type LayoutType = 'single' | 'grid' | 'steps'

/**
 * 字段属性采用"松散可选包"而不是每种类型一个独立类型：
 * 新增字段类型时不用改 Schema 结构，只需在 field-meta 注册表里加配置。
 */
export interface FieldProps {
  placeholder?: string
  defaultValue?: unknown
  /** select / radio / checkbox 的候选项 */
  options?: FieldOption[]
  multiple?: boolean
  rows?: number
  min?: number
  max?: number
  step?: number
  /** upload */
  accept?: string
  maxSizeMB?: number
  maxCount?: number
  /** subform 内部栅格列数 */
  columns?: number
}

export interface FieldOption {
  label: string
  value: string
}

/**
 * 校验规则是"数据"不是"函数"：
 * 才能序列化、能导入导出、二期 React 端能复用同一份规则。
 */
export type Rule =
  | { type: 'required'; message?: string }
  | { type: 'pattern'; value: string; message?: string }
  | { type: 'range'; min?: number; max?: number; message?: string }
  | { type: 'len'; min?: number; max?: number; message?: string }

/**
 * 字段联动条件是"结构"不是"表达式字符串"：
 * 避免 new Function / eval 求值，安全边界可讲。
 */
export interface Condition {
  /** 依赖字段的 name（同级作用域） */
  field: string
  op: 'eq' | 'neq' | 'in' | 'empty' | 'notEmpty'
  value?: unknown
}

export interface FieldNode {
  /** 设计器内部唯一 key（nanoid），用于选中态与列表 diff */
  id: string
  /** 提交字段名，同级唯一 */
  name: string
  type: FieldType
  label: string
  props: FieldProps
  rules: Rule[]
  visibleWhen?: Condition
  /** 仅 subform 使用 */
  children?: FieldNode[]
  /** grid 布局下的跨列数 */
  layout?: { span: number }
}

export interface FormLayout {
  type: LayoutType
  /** grid 模式下总列数，默认 2 */
  columns?: number
}

export interface FormSchema {
  /** 顶层版本号，二期迁移用（migrate.ts） */
  schemaVersion: 1
  id: string
  name: string
  layout: FormLayout
  fields: FieldNode[]
  submit?: {
    text?: string
    successMsg?: string
  }
}

/** 一次提交的记录结构（一期落 localStorage，二期换真接口时结构不变） */
export interface SubmitPayload {
  schemaId: string
  schemaVersion: number
  /** 表单值：扁平 key = 字段 name，子表单值 = 对象数组 */
  data: Record<string, unknown>
  submittedAt: string
}

/**
 * 提交适配器：一期实现 LocalSubmitAdapter（写 localStorage），
 * 二期换真实后端时调用方零改动 —— 接口抽象的落点。
 */
export interface SubmitAdapter {
  submit(payload: SubmitPayload): Promise<{ ok: true } | { ok: false; error: string }>
}
