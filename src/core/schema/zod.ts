/**
 * Schema 结构层校验（docs/一期-技术方案.md §2.4）
 *
 * 只负责回答"这段 JSON 是不是一个合法 FormSchema"，
 * 不负责校验用户填写的值（那是 engine/validate.ts 的事）。
 *
 * 用 z.ZodType<FormSchema> 注解而非 z.infer 反向推导：
 * 类型真源始终是 types.ts，zod 只做运行时镜像，两边一旦不一致编译期就报错。
 */
import { z } from 'zod'
import { FIELD_TYPES, type Condition, type FieldNode, type FormSchema, type Rule } from './types'

/** 结构非法时给 UI 用的扁平错误：path 已格式化成 fields[0].props.options[0].value */
export interface SchemaIssue {
  path: string
  message: string
}

const fieldOptionSchema = z.strictObject({
  label: z.string(),
  value: z.string(),
})

/** props 是"松散可选包"：字段全可选，但不允许拼错 key（否则配置被静默丢掉） */
const fieldPropsSchema = z.strictObject({
  placeholder: z.string().optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(fieldOptionSchema).optional(),
  multiple: z.boolean().optional(),
  rows: z.number().int().positive().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  accept: z.string().optional(),
  maxSizeMB: z.number().positive().optional(),
  maxCount: z.number().int().positive().optional(),
  columns: z.number().int().positive().optional(),
})

/** 规则是数据不是函数：这里只认 4 种可序列化类型 */
const ruleSchema: z.ZodType<Rule> = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('required'), message: z.string().optional() }),
  z.strictObject({
    type: z.literal('pattern'),
    value: z.string(),
    message: z.string().optional(),
  }),
  z.strictObject({
    type: z.literal('range'),
    min: z.number().optional(),
    max: z.number().optional(),
    message: z.string().optional(),
  }),
  z.strictObject({
    type: z.literal('len'),
    min: z.number().optional(),
    max: z.number().optional(),
    message: z.string().optional(),
  }),
])

/** 联动条件是结构化数据，刻意不支持表达式字符串 */
const conditionSchema: z.ZodType<Condition> = z.strictObject({
  field: z.string().min(1),
  op: z.enum(['eq', 'neq', 'in', 'empty', 'notEmpty']),
  value: z.unknown().optional(),
})

/** subform 可无限嵌套，只能用 lazy 打破类型与求值的循环 */
const fieldNodeSchema: z.ZodType<FieldNode> = z.lazy(() =>
  z.strictObject({
    id: z.string().min(1),
    name: z.string().min(1, '字段名不能为空'),
    type: z.enum(FIELD_TYPES),
    label: z.string(),
    props: fieldPropsSchema,
    rules: z.array(ruleSchema),
    visibleWhen: conditionSchema.optional(),
    children: z.array(fieldNodeSchema).optional(),
    layout: z.strictObject({ span: z.number().int().positive() }).optional(),
  }),
)

export const formSchemaSchema: z.ZodType<FormSchema> = z.strictObject({
  schemaVersion: z.literal(1, 'schemaVersion 必须为 1；更高版本请先执行 migrate()'),
  id: z.string().min(1),
  name: z.string(),
  layout: z.strictObject({
    type: z.enum(['single', 'grid', 'steps']),
    columns: z.number().int().positive().optional(),
  }),
  fields: z.array(fieldNodeSchema),
  submit: z
    .strictObject({
      text: z.string().optional(),
      successMsg: z.string().optional(),
    })
    .optional(),
})

/** 把 zod 的 path 数组渲染成人能读的定位串：fields[3].props.options[0].value */
export function formatIssuePath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '(root)'
  return path.reduce<string>((acc, key) => {
    if (typeof key === 'number') return `${acc}[${key}]`
    return acc ? `${acc}.${String(key)}` : String(key)
  }, '')
}

export type ParseSchemaResult =
  { ok: true; data: FormSchema } | { ok: false; issues: SchemaIssue[] }

/**
 * 导入 JSON / 读取草稿的统一入口。
 * 失败时返回带可读路径的 issues，调用方可以直接展示，画布不会拿到半截数据。
 */
export function parseFormSchema(input: unknown): ParseSchemaResult {
  const result = formSchemaSchema.safeParse(input)
  if (result.success) return { ok: true, data: result.data }

  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: formatIssuePath(issue.path),
      message: issue.message,
    })),
  }
}
