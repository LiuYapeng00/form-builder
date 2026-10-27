import { describe, expect, it } from 'vitest'
import { createEmptySchema, createField } from '@/core/schema/factory'
import { FIELD_TYPES, type FieldProps, type FormSchema } from '@/core/schema/types'
import { formatIssuePath, parseFormSchema } from '@/core/schema/zod'

function makeSchema(): FormSchema {
  const subform = createField('subform', {
    children: [createField('input', { name: 'employeeName' })],
  })
  return {
    ...createEmptySchema('测试表单'),
    fields: [createField('input', { name: 'title' }), subform],
  }
}

describe('formSchemaSchema', () => {
  it('接受工厂生成的空表单', () => {
    const result = parseFormSchema(createEmptySchema())
    expect(result.ok).toBe(true)
  })

  it('接受全部 11 种字段类型（含嵌套 subform）', () => {
    const schema = makeSchema()
    schema.fields = FIELD_TYPES.map((type, index) =>
      createField(type, { name: `${type}_${index}` }),
    )
    const nested = createField('subform', {
      name: 'employees',
      children: [createField('input', { name: 'name' })],
    })
    schema.fields.push(nested)

    const result = parseFormSchema(schema)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.fields).toHaveLength(12)
      expect(result.data.fields[11]?.children?.[0]?.name).toBe('name')
    }
  })

  it('拒绝缺失的 schemaVersion，路径指向 root', () => {
    const { schemaVersion: _omit, ...rest } = makeSchema()
    const result = parseFormSchema(rest)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path === 'schemaVersion')).toBe(true)
      expect(result.issues[0]?.message).toBeTruthy()
    }
  })

  it('拒绝未来版本并给出可读提示', () => {
    const result = parseFormSchema({ ...makeSchema(), schemaVersion: 2 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.path).toBe('schemaVersion')
      expect(result.issues[0]?.message).toContain('migrate')
    }
  })

  it('非法 options 能定位到具体下标', () => {
    const schema = makeSchema()
    schema.fields[0] = createField('select', {
      name: 'city',
      props: { options: [{ label: '北京' } as unknown as { label: string; value: string }] },
    })

    const result = parseFormSchema(schema)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.path).toBe('fields[0].props.options[0].value')
    }
  })

  it('非法规则能定位到具体字段与规则', () => {
    const schema = makeSchema()
    schema.fields[0] = createField('input', {
      name: 'email',
      rules: [{ type: 'pattern' } as unknown as { type: 'pattern'; value: string }],
    })

    const result = parseFormSchema(schema)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.path).toBe('fields[0].rules[0].value')
    }
  })

  it('嵌套子表单内的非法字段路径可读', () => {
    const schema = makeSchema()
    const subform = schema.fields[1]
    if (!subform) throw new Error('测试数据缺少子表单')
    subform.children = [createField('input', { name: '' })]

    const result = parseFormSchema(schema)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.path).toBe('fields[1].children[0].name')
    }
  })

  it('拒绝拼错的 props key，避免配置被静默丢弃', () => {
    const schema = makeSchema()
    schema.fields[0] = {
      ...createField('input'),
      props: { placehoder: '错字' } as unknown as FieldProps,
    }

    const result = parseFormSchema(schema)
    expect(result.ok).toBe(false)
  })
})

describe('formatIssuePath', () => {
  it('数字下标用方括号，字符串用点号', () => {
    expect(formatIssuePath(['fields', 3, 'props', 'options', 0, 'value'])).toBe(
      'fields[3].props.options[0].value',
    )
    expect(formatIssuePath([])).toBe('(root)')
  })
})
