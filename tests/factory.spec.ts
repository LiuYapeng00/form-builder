import { describe, expect, it } from 'vitest'
import { createEmptySchema, createField, getDefaultProps } from '@/core/schema/factory'
import { FIELD_TYPES } from '@/core/schema/types'

describe('createField', () => {
  it('每次调用生成唯一 id 与 name', () => {
    const fields = Array.from({ length: 100 }, () => createField('input'))
    expect(new Set(fields.map((field) => field.id)).size).toBe(100)
    expect(new Set(fields.map((field) => field.name)).size).toBe(100)
  })

  it('按类型给出默认 label 与 props', () => {
    expect(createField('textarea').props.rows).toBe(3)
    expect(createField('select').props.options).toHaveLength(2)
    expect(createField('number').props.step).toBe(1)
    expect(createField('upload').props.maxSizeMB).toBe(5)
    expect(createField('subform').children).toEqual([])
    expect(createField('divider').label).toBe('分割线')
  })

  it('默认 props 不共享引用（改副本不影响下一次生成）', () => {
    const first = createField('select')
    const second = createField('select')

    first.props.options?.push({ label: '选项三', value: 'option3' })
    if (first.props.options?.[0]) first.props.options[0].label = '被改坏了'

    expect(second.props.options).toHaveLength(2)
    expect(second.props.options?.[0]?.label).toBe('选项一')
    expect(getDefaultProps('select').options).toHaveLength(2)
  })

  it('允许覆盖 label / name / props', () => {
    const field = createField('select', {
      name: 'city',
      label: '城市',
      props: { options: [{ label: '北京', value: 'beijing' }], multiple: true },
    })

    expect(field.name).toBe('city')
    expect(field.label).toBe('城市')
    expect(field.props.options).toEqual([{ label: '北京', value: 'beijing' }])
    expect(field.props.multiple).toBe(true)
  })

  it('rules 默认是独立空数组', () => {
    const first = createField('input')
    const second = createField('input')

    first.rules.push({ type: 'required' })
    expect(second.rules).toEqual([])
    expect(first.rules).not.toBe(second.rules)
  })

  it('覆盖的 props 不会反向污染传入对象', () => {
    const field = createField('input', { props: {} })
    field.props.placeholder = '请输入'
    expect(getDefaultProps('input')).toEqual({})
  })
})

describe('createEmptySchema', () => {
  it('生成可直接渲染的骨架', () => {
    const schema = createEmptySchema('请假申请')

    expect(schema.schemaVersion).toBe(1)
    expect(schema.name).toBe('请假申请')
    expect(schema.layout).toEqual({ type: 'single' })
    expect(schema.fields).toEqual([])
    expect(schema.submit?.text).toBe('提交')
    expect(schema.id.length).toBeGreaterThan(0)
  })

  it('默认名称可用且 id 唯一', () => {
    const a = createEmptySchema()
    const b = createEmptySchema()

    expect(a.name).toBe('未命名表单')
    expect(a.id).not.toBe(b.id)
  })
})

describe('FIELD_TYPES 覆盖', () => {
  it('工厂能造出全部字段类型', () => {
    const fields = FIELD_TYPES.map((type) => createField(type))
    expect(fields.map((field) => field.type)).toEqual([...FIELD_TYPES])
  })
})
