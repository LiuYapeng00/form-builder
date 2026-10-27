/**
 * 字段类型 → 组件映射（T08）
 *
 * 这里只做"查表"，不写业务分支：
 * 新增字段类型时在 MAP 上加一行，其余渲染逻辑（label / 校验 / 设计态）由 FieldRenderer 统一处理。
 * 未实现的类型返回 undefined，由渲染层给出占位提示，避免整页白屏。
 */
import type { Component } from 'vue'
import type { FieldType } from '@/core/schema/types'
import DateField from './DateField.vue'
import InputField from './InputField.vue'
import NumberField from './NumberField.vue'
import SelectField from './SelectField.vue'
import SwitchField from './SwitchField.vue'
import TextareaField from './TextareaField.vue'

const FIELD_COMPONENTS: Partial<Record<FieldType, Component>> = {
  input: InputField,
  textarea: TextareaField,
  number: NumberField,
  select: SelectField,
  date: DateField,
  switch: SwitchField,
}

export function fieldComponent(type: FieldType): Component | undefined {
  return FIELD_COMPONENTS[type]
}
