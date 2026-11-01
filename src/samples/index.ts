/**
 * 内置示例模板（T25）
 *
 * 设计器「模板」下拉直接读这里；每个模板都必须能通过 zod，
 * 所以加模板时顺手在 tests/samples.spec.ts 里断言一遍。
 */
import type { FormSchema } from '@/core/schema/types'
import { employeeSampleSchema } from './employee'
import { leaveSampleSchema } from './leave'

export interface FormTemplate {
  id: string
  name: string
  description: string
  schema: FormSchema
}

export const FORM_TEMPLATES: readonly FormTemplate[] = [
  {
    id: 'leave',
    name: '请假申请',
    description: '基础字段 + 请假类型联动 + 交接事项子表单',
    schema: leaveSampleSchema,
  },
  {
    id: 'employee',
    name: '员工信息登记',
    description: '主数据 + 紧急联系人联动 + 工作经历子表单 + 简历附件',
    schema: employeeSampleSchema,
  },
]

export function findTemplate(id: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find((template) => template.id === id)
}
