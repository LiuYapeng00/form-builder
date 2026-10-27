/**
 * T12 用的手写样例 Schema（纯 JSON 数据，可整段替换成导出的 JSON）
 *
 * 刻意覆盖：6 种基础控件、栅格跨列、子表单对象数组、必填/正则/范围规则、visibleWhen 联动。
 * T25 的内置模板会在此基础上扩成"请假申请 / 员工信息登记"两套。
 */
import type { FormSchema } from '@/core/schema/types'

export const leaveSampleSchema: FormSchema = {
  schemaVersion: 1,
  id: 'sample-leave-application',
  name: '请假申请',
  layout: { type: 'grid', columns: 2 },
  submit: { text: '提交申请', successMsg: '请假申请已提交' },
  fields: [
    {
      id: 'f-applicant',
      name: 'applicant',
      type: 'input',
      label: '申请人',
      props: { placeholder: '请输入姓名' },
      rules: [{ type: 'required' }],
    },
    {
      id: 'f-department',
      name: 'department',
      type: 'select',
      label: '所属部门',
      props: {
        placeholder: '请选择部门',
        options: [
          { label: '研发部', value: 'rd' },
          { label: '产品部', value: 'product' },
          { label: '设计部', value: 'design' },
        ],
      },
      rules: [{ type: 'required' }],
    },
    {
      id: 'f-leave-type',
      name: 'leaveType',
      type: 'select',
      label: '请假类型',
      props: {
        placeholder: '请选择类型',
        options: [
          { label: '年假', value: 'annual' },
          { label: '病假', value: 'sick' },
          { label: '事假', value: 'personal' },
        ],
      },
      rules: [{ type: 'required' }],
    },
    {
      id: 'f-days',
      name: 'days',
      type: 'number',
      label: '请假天数',
      props: { min: 0.5, max: 30, step: 0.5 },
      rules: [
        { type: 'required' },
        { type: 'range', min: 0.5, max: 30, message: '请假天数需在 0.5 ~ 30 天之间' },
      ],
    },
    {
      id: 'f-start-date',
      name: 'startDate',
      type: 'date',
      label: '开始日期',
      props: {},
      rules: [{ type: 'required' }],
    },
    {
      id: 'f-urgent',
      name: 'urgent',
      type: 'switch',
      label: '加急处理',
      props: {},
      rules: [],
    },
    {
      id: 'f-urgent-reason',
      name: 'urgentReason',
      type: 'input',
      label: '加急原因',
      props: { placeholder: '为什么需要加急' },
      rules: [{ type: 'required' }],
      // 关掉加急后该字段隐藏，提交时值会被剔除（T11）
      visibleWhen: { field: 'urgent', op: 'eq', value: true },
    },
    {
      id: 'f-sick-remark',
      name: 'sickRemark',
      type: 'textarea',
      label: '病情说明',
      props: { rows: 3, placeholder: '病假请补充就诊信息' },
      rules: [{ type: 'required' }],
      layout: { span: 2 },
      visibleWhen: { field: 'leaveType', op: 'eq', value: 'sick' },
    },
    {
      id: 'f-reason',
      name: 'reason',
      type: 'textarea',
      label: '请假事由',
      props: { rows: 3, placeholder: '至少 5 个字' },
      rules: [
        { type: 'required' },
        { type: 'len', min: 5, max: 200, message: '请假事由需 5 ~ 200 字' },
      ],
      layout: { span: 2 },
    },
    {
      id: 'f-divider',
      name: 'handoverDivider',
      type: 'divider',
      label: '工作交接',
      props: {},
      rules: [],
      layout: { span: 2 },
    },
    {
      id: 'f-handover',
      name: 'handover',
      type: 'subform',
      label: '交接事项',
      props: { columns: 2 },
      rules: [],
      layout: { span: 2 },
      children: [
        {
          id: 'f-handover-item',
          name: 'item',
          type: 'input',
          label: '交接内容',
          props: { placeholder: '例如：需求文档' },
          rules: [{ type: 'required' }],
        },
        {
          id: 'f-handover-date',
          name: 'handoverDate',
          type: 'date',
          label: '交接日期',
          props: {},
          rules: [{ type: 'required' }],
        },
      ],
    },
  ],
}
