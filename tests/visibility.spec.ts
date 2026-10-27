import { describe, expect, it } from 'vitest'
import {
  evaluateCondition,
  isEmptyValue,
  isFieldVisible,
  pruneHiddenValues,
  visibleFields,
} from '@/core/engine/visibility'
import { createField } from '@/core/schema/factory'
import type { Condition, FieldNode } from '@/core/schema/types'

function field(name: string, condition?: Condition): FieldNode {
  return createField('input', {
    name,
    label: name,
    ...(condition ? { visibleWhen: condition } : {}),
  })
}

describe('isEmptyValue', () => {
  it('undefined / null / 空串 / 纯空格 / 空数组算空', () => {
    for (const value of [undefined, null, '', '   ', []]) {
      expect(isEmptyValue(value)).toBe(true)
    }
  })

  it('0 / false / 非空字符串 / 非空数组不算空', () => {
    for (const value of [0, false, 'a', [0]]) {
      expect(isEmptyValue(value)).toBe(false)
    }
  })
})

describe('evaluateCondition', () => {
  const values = { type: 'sick', urgent: true, tags: ['a', 'b'], note: '' }

  it('eq / neq', () => {
    expect(evaluateCondition({ field: 'type', op: 'eq', value: 'sick' }, values)).toBe(true)
    expect(evaluateCondition({ field: 'type', op: 'neq', value: 'sick' }, values)).toBe(false)
    expect(evaluateCondition({ field: 'urgent', op: 'eq', value: true }, values)).toBe(true)
  })

  it('in 兼容多选值与候选列表两种方向', () => {
    expect(evaluateCondition({ field: 'tags', op: 'in', value: 'a' }, values)).toBe(true)
    expect(evaluateCondition({ field: 'tags', op: 'in', value: 'c' }, values)).toBe(false)
    expect(evaluateCondition({ field: 'type', op: 'in', value: ['sick', 'annual'] }, values)).toBe(
      true,
    )
  })

  it('empty / notEmpty 对空串与缺失字段成立', () => {
    expect(evaluateCondition({ field: 'note', op: 'empty' }, values)).toBe(true)
    expect(evaluateCondition({ field: 'missing', op: 'empty' }, values)).toBe(true)
    expect(evaluateCondition({ field: 'type', op: 'notEmpty' }, values)).toBe(true)
  })

  it('对象值按结构比较', () => {
    const scope = { range: { min: 1, max: 2 } }
    expect(evaluateCondition({ field: 'range', op: 'eq', value: { min: 1, max: 2 } }, scope)).toBe(
      true,
    )
  })
})

describe('visibleFields / isFieldVisible', () => {
  const fields: FieldNode[] = [
    field('type'),
    field('sickRemark', { field: 'type', op: 'eq', value: 'sick' }),
  ]

  it('条件成立才显示，且不改原数组', () => {
    expect(visibleFields(fields, { type: 'annual' }).map((item) => item.name)).toEqual(['type'])
    expect(visibleFields(fields, { type: 'sick' }).map((item) => item.name)).toEqual([
      'type',
      'sickRemark',
    ])
    expect(fields).toHaveLength(2)
  })

  it('级联：依赖源自己隐藏时，下游也隐藏', () => {
    const cascade: FieldNode[] = [
      field('a'),
      field('b', { field: 'a', op: 'notEmpty' }),
      field('c', { field: 'b', op: 'notEmpty' }),
    ]

    expect(visibleFields(cascade, { a: '', b: 'x' }).map((item) => item.name)).toEqual(['a'])
    expect(visibleFields(cascade, { a: '1', b: 'x' }).map((item) => item.name)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('循环依赖不死循环', () => {
    const cyclic: FieldNode[] = [
      field('a', { field: 'b', op: 'notEmpty' }),
      field('b', { field: 'a', op: 'notEmpty' }),
    ]

    expect(() => visibleFields(cyclic, { a: '1', b: '2' })).not.toThrow()
    expect(isFieldVisible(cyclic[0] as FieldNode, cyclic, { a: '1', b: '2' })).toBe(true)
  })
})

describe('pruneHiddenValues', () => {
  const fields: FieldNode[] = [
    field('type'),
    field('sickRemark', { field: 'type', op: 'eq', value: 'sick' }),
    createField('subform', {
      name: 'rows',
      children: [field('item'), field('detail', { field: 'item', op: 'notEmpty' })],
    }),
  ]

  it('剔除隐藏字段，保留可见字段', () => {
    const data = { type: 'annual', sickRemark: '不该被提交' }
    expect(pruneHiddenValues(fields, data)).toEqual({ type: 'annual' })
  })

  it('递归清洗子表单每一行', () => {
    const data = {
      type: 'sick',
      sickRemark: '发烧',
      rows: [
        { item: '文档', detail: '交接说明' },
        { item: '', detail: 'item 为空时 detail 隐藏' },
      ],
    }

    const pruned = pruneHiddenValues(fields, data)
    expect(pruned).toEqual({
      type: 'sick',
      sickRemark: '发烧',
      rows: [{ item: '文档', detail: '交接说明' }, { item: '' }],
    })
  })

  it('不修改传入的 model，切换条件后原值可恢复', () => {
    const data = { type: 'annual', sickRemark: '保留' }
    const pruned = pruneHiddenValues(fields, data)

    expect(pruned).not.toBe(data)
    expect(data.sickRemark).toBe('保留')
    expect('sickRemark' in pruned).toBe(false)
  })
})
