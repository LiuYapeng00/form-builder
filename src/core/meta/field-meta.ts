/**
 * 字段元数据注册表（docs/一期-技术方案.md §5、任务清单 T07）
 *
 * 一个字段类型的全部"静态知识"都收敛在这里：
 * 默认标题、默认 props、图标名、属性面板配置项、支持的校验类型、能否含子字段。
 * UI 层（物料区 / 属性面板 / 画布）只读元数据，不写 if (type === 'xxx')。
 *
 * 两条边界：
 * 1. icon 只存名字（比如 'EditPen'），core 不能 import element-plus；
 *    真实图标组件由 UI 层按名字映射。
 * 2. createDefaultProps 是工厂而不是对象，每次返回深拷贝，
 *    避免"拖两个下拉框，改一个的选项另一个跟着变"的共享引用 bug。
 */
import { FIELD_TYPES } from '../schema/types'
import type { FieldProps, FieldType, Rule } from '../schema/types'

/** 属性面板里一个配置项该用什么控件渲染 */
export type PropControlType = 'text' | 'textarea' | 'number' | 'switch' | 'options'

/** 属性面板配置项：只描述"改哪个 prop、用什么控件"，不含任何 Vue 概念 */
export interface PropMeta {
  key: keyof FieldProps
  label: string
  control: PropControlType
  placeholder?: string
  hint?: string
  /** number 控件的取值范围/步长，同时用于非法输入兜底 */
  min?: number
  max?: number
  step?: number
}

export interface FieldMeta {
  type: FieldType
  /** 新字段的默认标题（物料区展示名也用它） */
  label: string
  /** Element Plus 图标名，UI 层负责映射成组件 */
  icon: string
  /** 每次调用都返回全新的 props，调用方随便改 */
  createDefaultProps: () => FieldProps
  /** 属性面板要展示的配置项（元数据驱动，加配置只改这里） */
  props: PropMeta[]
  /** 该字段允许配置的校验规则类型 */
  rules: Rule['type'][]
  /** 能否包含子字段：目前只有 subform */
  container: boolean
}

const DEFAULT_LABEL: Record<FieldType, string> = {
  input: '单行文本',
  textarea: '多行文本',
  number: '数字',
  select: '下拉选择',
  radio: '单选',
  checkbox: '多选',
  switch: '开关',
  date: '日期',
  upload: '附件',
  subform: '子表单',
  divider: '分割线',
}

const DEFAULT_OPTIONS = [
  { label: '选项一', value: 'option1' },
  { label: '选项二', value: 'option2' },
]

/**
 * 默认 props 的唯一真源。
 * 这里只放"字段一诞生就该有的值"，不放运行时用户填的值。
 */
const DEFAULT_PROPS: Record<FieldType, FieldProps> = {
  input: {},
  textarea: { rows: 3 },
  number: { step: 1 },
  select: { options: DEFAULT_OPTIONS, multiple: false },
  radio: { options: DEFAULT_OPTIONS },
  checkbox: { options: DEFAULT_OPTIONS },
  switch: {},
  date: {},
  upload: { maxSizeMB: 5, maxCount: 1 },
  subform: { columns: 1 },
  divider: {},
}

const PLACEHOLDER: PropMeta = {
  key: 'placeholder',
  label: '占位提示',
  control: 'text',
  placeholder: '请输入',
}

/** 各类字段共用的 props 配置片段，引用可以共享：PropMeta 只读 */
const OPTIONS_META: PropMeta = {
  key: 'options',
  label: '选项',
  control: 'options',
  hint: '至少保留一项，value 同级唯一',
}

function cloneProps(type: FieldType): FieldProps {
  return structuredClone(DEFAULT_PROPS[type])
}

const META_ENTRIES: Record<FieldType, Omit<FieldMeta, 'createDefaultProps'>> = {
  input: {
    type: 'input',
    label: DEFAULT_LABEL.input,
    icon: 'EditPen',
    props: [PLACEHOLDER],
    rules: ['required', 'pattern', 'len'],
    container: false,
  },
  textarea: {
    type: 'textarea',
    label: DEFAULT_LABEL.textarea,
    icon: 'Document',
    props: [PLACEHOLDER, { key: 'rows', label: '显示行数', control: 'number', min: 1, max: 20 }],
    rules: ['required', 'pattern', 'len'],
    container: false,
  },
  number: {
    type: 'number',
    label: DEFAULT_LABEL.number,
    icon: 'Odometer',
    props: [
      PLACEHOLDER,
      { key: 'min', label: '最小值', control: 'number' },
      { key: 'max', label: '最大值', control: 'number' },
      { key: 'step', label: '步长', control: 'number', min: 0.01 },
    ],
    rules: ['required', 'range'],
    container: false,
  },
  select: {
    type: 'select',
    label: DEFAULT_LABEL.select,
    icon: 'ArrowDown',
    props: [PLACEHOLDER, OPTIONS_META, { key: 'multiple', label: '允许多选', control: 'switch' }],
    rules: ['required'],
    container: false,
  },
  radio: {
    type: 'radio',
    label: DEFAULT_LABEL.radio,
    icon: 'CircleCheck',
    props: [OPTIONS_META],
    rules: ['required'],
    container: false,
  },
  checkbox: {
    type: 'checkbox',
    label: DEFAULT_LABEL.checkbox,
    icon: 'Finished',
    props: [OPTIONS_META],
    rules: ['required'],
    container: false,
  },
  switch: {
    type: 'switch',
    label: DEFAULT_LABEL.switch,
    icon: 'SwitchButton',
    props: [],
    rules: ['required'],
    container: false,
  },
  date: {
    type: 'date',
    label: DEFAULT_LABEL.date,
    icon: 'Calendar',
    props: [{ ...PLACEHOLDER, placeholder: '请选择日期' }],
    rules: ['required'],
    container: false,
  },
  upload: {
    type: 'upload',
    label: DEFAULT_LABEL.upload,
    icon: 'UploadFilled',
    props: [
      { key: 'accept', label: '允许类型', control: 'text', placeholder: '.pdf,.png' },
      { key: 'maxSizeMB', label: '单文件大小上限(MB)', control: 'number', min: 0.1 },
      { key: 'maxCount', label: '最多文件数', control: 'number', min: 1 },
    ],
    rules: ['required'],
    container: false,
  },
  subform: {
    type: 'subform',
    label: DEFAULT_LABEL.subform,
    icon: 'Files',
    props: [{ key: 'columns', label: '内部列数', control: 'number', min: 1, max: 4 }],
    rules: ['required'],
    container: true,
  },
  divider: {
    type: 'divider',
    label: DEFAULT_LABEL.divider,
    icon: 'Minus',
    props: [],
    rules: [],
    container: false,
  },
}

/** 组装成完整注册表：把"深拷贝默认 props"这一步固化，调用方拿不到共享对象 */
const FIELD_METAS = Object.fromEntries(
  FIELD_TYPES.map((type) => [
    type,
    { ...META_ENTRIES[type], createDefaultProps: () => cloneProps(type) } satisfies FieldMeta,
  ]),
) as Record<FieldType, FieldMeta>

/** 按类型取元数据；type 来自 FieldType，查不到属于类型系统应该拦住的情况 */
export function getFieldMeta(type: FieldType): FieldMeta {
  return FIELD_METAS[type]
}

/** 物料区按固定顺序渲染，顺序就是 FIELD_TYPES 的定义顺序 */
export const FIELD_META_LIST: readonly FieldMeta[] = FIELD_TYPES.map((type) => FIELD_METAS[type])

/** 是否可作为容器（画布上要渲染子字段区域） */
export function isContainerType(type: FieldType): boolean {
  return FIELD_METAS[type].container
}
