import { describe, expect, it } from 'vitest'
import { createFormValue, createRowValue, defaultValueForField } from '@/core/engine/values'
import { createField } from '@/core/schema/factory'
import type { FieldNode } from '@/core/schema/types'

describe('defaultValueForField', () => {
  it('switch 默认 false，checkbox / subform / upload 默认空数组', () => {
    expect(defaultValueForField(createField('switch'))).toBe(false)
    expect(defaultValueForField(createField('checkbox'))).toEqual([])
    expect(defaultValueForField(createField('subform'))).toEqual([])
    expect(defaultValueForField(createField('upload'))).toEqual([])
  })

  it('普通文本字段没有初始值', () => {
    expect(defaultValueForField(createField('input'))).toBeUndefined()
  })

  it('显式 defaultValue 深拷贝，改模型不污染 schema', () => {
    const field: FieldNode = createField('checkbox', {
      props: { defaultValue: ['a', 'b'] },
    })
    const value = defaultValueForField(field) as string[]

    value.push('c')
    expect(field.props.defaultValue).toEqual(['a', 'b'])
  })
})

describe('createRowValue / createFormValue', () => {
  const fields: FieldNode[] = [
    createField('input', { name: 'title' }),
    createField('switch', { name: 'enabled' }),
    createField('divider', { name: 'divider' }),
    createField('subform', { name: 'rows', children: [createField('input', { name: 'item' })] }),
  ]

  it('只生成有值的字段，divider 不产生值', () => {
    expect(createRowValue(fields)).toEqual({
      enabled: false,
      rows: [],
    })
  })

  it('子表单初始为空数组，行值由 createRowValue 单独生成', () => {
    const model = createFormValue(fields)
    expect(model.rows).toEqual([])
    expect(createRowValue(fields[3]?.children ?? [])).toEqual({})
  })

  it('每次生成独立对象', () => {
    const a = createFormValue(fields)
    const b = createFormValue(fields)

    a.enabled = true
    expect(b.enabled).toBe(false)
  })
})
