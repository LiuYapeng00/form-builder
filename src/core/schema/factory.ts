/**
 * Schema 工厂（docs/一期-任务清单.md T05）
 *
 * 所有字段都必须从这里诞生：
 * - id 用 nanoid 保证唯一
 * - 默认 props 每次深拷贝，杜绝"拖两次后两个字段共享同一份 options 数组"的经典 bug
 *
 * T07 起默认值收敛到 field-meta 注册表，factory 只保留"造节点"这一件事。
 */
import { nanoid } from 'nanoid'
import { getFieldMeta } from '../meta/field-meta'
import type { Condition, FieldNode, FieldProps, FieldType, FormSchema, Rule } from './types'

/** 返回一份全新的默认 props，调用方随便改都不会污染注册表 */
export function getDefaultProps(type: FieldType): FieldProps {
  return getFieldMeta(type).createDefaultProps()
}

export interface CreateFieldOptions {
  name?: string
  label?: string
  props?: FieldProps
  rules?: Rule[]
  visibleWhen?: Condition
  layout?: { span: number }
  /** 仅 subform 使用；传入的节点不会被复制 */
  children?: FieldNode[]
}

/**
 * 生成字段节点。
 * name 默认带随机后缀：schema 要求同级唯一，而工厂不知道兄弟列表，
 * 只能先保证"几乎不重名"，真正的去重交给设计器在插入时校验。
 */
export function createField(type: FieldType, options: CreateFieldOptions = {}): FieldNode {
  const field: FieldNode = {
    id: nanoid(),
    name: options.name ?? `${type}_${nanoid(8)}`,
    type,
    label: options.label ?? getFieldMeta(type).label,
    props: { ...getDefaultProps(type), ...(options.props ?? {}) },
    rules: [...(options.rules ?? [])],
  }

  if (options.visibleWhen) field.visibleWhen = structuredClone(options.visibleWhen)
  if (options.layout) field.layout = { ...options.layout }
  if (options.children) field.children = [...options.children]
  else if (type === 'subform') field.children = []

  return field
}

/** 新表单骨架：layout 默认单列，提交文案给一个能直接用的默认值 */
export function createEmptySchema(name = '未命名表单'): FormSchema {
  return {
    schemaVersion: 1,
    id: nanoid(),
    name,
    layout: { type: 'single' },
    fields: [],
    submit: { text: '提交', successMsg: '提交成功' },
  }
}

/**
 * 复制字段（T15）
 *
 * 两层要求：
 * 1. 引用不共享：structuredClone 深拷贝，否则改副本会连带改原件；
 * 2. id 全层级重新生成：id 是设计器的选中 key，重复会让选中态错乱。
 * 根节点同时换 name（同级唯一）；子字段 name 属于新作用域，可以保留。
 *
 * 注意：内部用 structuredClone，Vue 调用方必须先 toRaw（Proxy 不可克隆）。
 */
export function cloneField(source: FieldNode): FieldNode {
  const clone = cloneNode(source)
  clone.name = `${source.type}_${nanoid(8)}`
  return clone
}

function cloneNode(source: FieldNode): FieldNode {
  const clone = structuredClone(source)
  clone.id = nanoid()
  if (clone.children) clone.children = clone.children.map((child) => cloneNode(child))
  return clone
}
