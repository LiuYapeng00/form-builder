import { describe, expect, it } from 'vitest'
import { FORM_TEMPLATES, findTemplate } from '@/samples'
import { parseFormSchema } from '@/core/schema/zod'
import type { FieldNode } from '@/core/schema/types'

/** 递归收集字段，方便断言"每个模板都有子表单和联动" */
function flatten(fields: FieldNode[]): FieldNode[] {
  return fields.flatMap((field) => [field, ...flatten(field.children ?? [])])
}

describe('内置示例模板', () => {
  it('请假申请 / 员工信息登记两套，id 唯一', () => {
    expect(FORM_TEMPLATES).toHaveLength(2)
    expect(new Set(FORM_TEMPLATES.map((template) => template.id)).size).toBe(2)
    expect(FORM_TEMPLATES.map((template) => template.name)).toEqual(['请假申请', '员工信息登记'])
  })

  it.each(FORM_TEMPLATES)('$name 能通过 zod 结构校验', (template) => {
    const result = parseFormSchema(template.schema)
    expect(result.ok).toBe(true)
  })

  it.each(FORM_TEMPLATES)('$name 同时包含子表单与联动字段', (template) => {
    const all = flatten(template.schema.fields)

    expect(all.some((field) => field.type === 'subform')).toBe(true)
    expect(all.some((field) => field.visibleWhen !== undefined)).toBe(true)
  })

  it('同级字段名唯一（提交数据的 key 不能撞）', () => {
    for (const template of FORM_TEMPLATES) {
      const scopes = [
        template.schema.fields,
        ...flatten(template.schema.fields).map((field) => field.children ?? []),
      ]
      for (const scope of scopes) {
        const names = scope.filter((field) => field.type !== 'divider').map((field) => field.name)
        expect(new Set(names).size).toBe(names.length)
      }
    }
  })

  it('findTemplate 按 id 查找，未知 id 返回 undefined', () => {
    expect(findTemplate('employee')?.name).toBe('员工信息登记')
    expect(findTemplate('not-exist')).toBeUndefined()
  })
})
