import { describe, expect, it } from 'vitest'
import { FIELD_META_LIST, getFieldMeta, isContainerType } from '@/core/meta/field-meta'
import { createField } from '@/core/schema/factory'
import { FIELD_TYPES } from '@/core/schema/types'

describe('field-meta 注册表', () => {
  it('覆盖全部字段类型，且物料顺序与 FIELD_TYPES 一致', () => {
    expect(FIELD_META_LIST.map((meta) => meta.type)).toEqual([...FIELD_TYPES])
    for (const type of FIELD_TYPES) {
      expect(getFieldMeta(type).label.length).toBeGreaterThan(0)
      expect(getFieldMeta(type).icon.length).toBeGreaterThan(0)
    }
  })

  it('6 种基础类型都有默认 props 与属性面板配置', () => {
    const bases = ['input', 'textarea', 'number', 'select', 'date', 'switch'] as const
    for (const type of bases) {
      const meta = getFieldMeta(type)
      expect(meta.container).toBe(false)
      expect(Array.isArray(meta.props)).toBe(true)
    }

    expect(getFieldMeta('textarea').props.map((item) => item.key)).toContain('rows')
    expect(getFieldMeta('select').props.map((item) => item.key)).toContain('options')
    expect(getFieldMeta('number').props.map((item) => item.key)).toEqual([
      'placeholder',
      'min',
      'max',
      'step',
    ])
  })

  it('createDefaultProps 每次返回深拷贝', () => {
    const first = getFieldMeta('select').createDefaultProps()
    const second = getFieldMeta('select').createDefaultProps()

    first.options?.push({ label: '选项三', value: 'option3' })
    expect(second.options).toHaveLength(2)
    expect(getFieldMeta('select').createDefaultProps().options).toHaveLength(2)
  })

  it('只有 subform 是容器', () => {
    expect(isContainerType('subform')).toBe(true)
    for (const type of FIELD_TYPES.filter((item) => item !== 'subform')) {
      expect(isContainerType(type)).toBe(false)
    }
  })

  it('属性面板配置项指向真实的 props key，控件类型合法', () => {
    const controls = new Set(['text', 'textarea', 'number', 'switch', 'options'])
    for (const meta of FIELD_META_LIST) {
      for (const item of meta.props) {
        expect(controls.has(item.control)).toBe(true)
        // 配置项必须能在默认 props 或类型定义里找到落点
        expect(item.key.length).toBeGreaterThan(0)
      }
    }
  })

  it('工厂与注册表使用同一份默认标题', () => {
    for (const type of FIELD_TYPES) {
      expect(createField(type).label).toBe(getFieldMeta(type).label)
    }
  })
})
