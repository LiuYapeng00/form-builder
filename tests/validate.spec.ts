import { describe, expect, it } from 'vitest'
import { buildFieldRules, buildFormRules } from '@/core/engine/validate'
import { createField } from '@/core/schema/factory'
import type { FieldNode, Rule } from '@/core/schema/types'

function fieldWith(type: Parameters<typeof createField>[0], rules: Rule[]): FieldNode {
  return createField(type, { label: '测试字段', rules })
}

describe('buildFieldRules', () => {
  it('required：文本类走 blur，并禁止纯空格', () => {
    const [rule] = buildFieldRules(fieldWith('input', [{ type: 'required' }]))

    expect(rule).toMatchObject({
      required: true,
      whitespace: true,
      message: '请输入测试字段',
      trigger: 'blur',
    })
    expect(rule?.type).toBeUndefined()
  })

  it('required：选择类走 change，checkbox 带 array 类型', () => {
    const [selectRule] = buildFieldRules(fieldWith('select', [{ type: 'required' }]))
    expect(selectRule?.trigger).toBe('change')
    expect(selectRule?.type).toBeUndefined()

    const [checkboxRule] = buildFieldRules(fieldWith('checkbox', [{ type: 'required' }]))
    expect(checkboxRule).toMatchObject({ required: true, type: 'array', trigger: 'change' })
  })

  it('select multiple 的 required 也按数组判空', () => {
    const field = createField('select', { rules: [{ type: 'required' }] })
    field.props.multiple = true

    expect(buildFieldRules(field)[0]?.type).toBe('array')
  })

  it('upload 的 required 按文件名数组判空', () => {
    const [rule] = buildFieldRules(fieldWith('upload', [{ type: 'required' }]))

    expect(rule).toMatchObject({
      required: true,
      type: 'array',
      message: '请上传测试字段',
      trigger: 'change',
    })
  })

  it('range 生成数值比较规则，并给出可读文案', () => {
    const [rule] = buildFieldRules(fieldWith('number', [{ type: 'range', min: 0.5, max: 30 }]))

    expect(rule).toMatchObject({
      type: 'number',
      min: 0.5,
      max: 30,
      message: '测试字段需在 0.5 ~ 30 之间',
      trigger: 'blur',
    })
  })

  it('len 生成长度规则，单边边界文案正确', () => {
    const [rule] = buildFieldRules(fieldWith('textarea', [{ type: 'len', min: 5 }]))
    expect(rule).toMatchObject({ min: 5, message: '测试字段长度需在 不小于 5 之间' })
  })

  it('pattern 转成 RegExp，自定义 message 优先', () => {
    const [rule] = buildFieldRules(
      fieldWith('input', [{ type: 'pattern', value: '^1\\d{10}$', message: '手机号不对' }]),
    )

    expect(rule?.pattern).toBeInstanceOf(RegExp)
    expect(rule?.pattern?.test('13800138000')).toBe(true)
    expect(rule?.message).toBe('手机号不对')
  })

  it('非法正则 / 空边界不抛错，直接跳过该规则', () => {
    expect(buildFieldRules(fieldWith('input', [{ type: 'pattern', value: '[' }]))).toEqual([])
    expect(buildFieldRules(fieldWith('number', [{ type: 'range' }]))).toEqual([])
    expect(buildFieldRules(fieldWith('input', [{ type: 'len' }]))).toEqual([])
  })

  it('divider 不参与校验，多条规则按顺序展开', () => {
    expect(buildFieldRules(fieldWith('divider', [{ type: 'required' }]))).toEqual([])

    const rules = buildFieldRules(
      fieldWith('input', [{ type: 'required' }, { type: 'len', min: 2, max: 8 }]),
    )
    expect(rules).toHaveLength(2)
    expect(rules[1]).toMatchObject({ min: 2, max: 8 })
  })
})

describe('buildFormRules', () => {
  it('递归生成子表单行的完整 prop 路径', () => {
    const subform = createField('subform', {
      name: 'handover',
      label: '交接',
      children: [
        createField('input', { name: 'item', label: '内容', rules: [{ type: 'required' }] }),
        createField('date', { name: 'date', label: '日期', rules: [{ type: 'required' }] }),
      ],
    })
    const fields = [
      createField('input', { name: 'applicant', label: '申请人', rules: [{ type: 'required' }] }),
      subform,
    ]

    const model = {
      applicant: '',
      handover: [{}, {}],
    }
    const rules = buildFormRules(fields, model)

    expect(Object.keys(rules)).toEqual([
      'applicant',
      'handover.0.item',
      'handover.0.date',
      'handover.1.item',
      'handover.1.date',
    ])
    expect(rules['handover.0.item']?.[0]?.required).toBe(true)
  })

  it('没有规则的字段不出现；子表单值不是数组时安全跳过', () => {
    const fields = [
      createField('input', { name: 'note' }),
      createField('subform', {
        name: 'rows',
        children: [createField('input', { name: 'x', rules: [{ type: 'required' }] })],
      }),
    ]

    expect(buildFormRules(fields, { note: '', rows: 'bad-data' })).toEqual({})
  })
})
