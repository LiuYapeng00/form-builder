/**
 * 员工信息登记模板（T25）
 *
 * 与请假申请互补：展示「员工主数据 + 工作经历子表单 + 紧急联系人联动 + 附件」。
 * 纯 JSON 数据，可以直接替换成设计器导出的内容。
 */
import type { FormSchema } from '@/core/schema/types'

export const employeeSampleSchema: FormSchema = {
  schemaVersion: 1,
  id: 'sample-employee-onboarding',
  name: '员工信息登记',
  layout: { type: 'grid', columns: 2 },
  submit: { text: '提交登记', successMsg: '员工信息已提交' },
  fields: [
    {
      id: 'f-emp-name',
      name: 'employeeName',
      type: 'input',
      label: '姓名',
      props: { placeholder: '请输入真实姓名' },
      rules: [{ type: 'required' }],
    },
    {
      id: 'f-emp-no',
      name: 'employeeNo',
      type: 'input',
      label: '工号',
      props: { placeholder: '例如 RD2026' },
      rules: [
        { type: 'required' },
        {
          type: 'pattern',
          value: '^[A-Z]{2}\\d{4}$',
          message: '工号格式为 2 位大写字母 + 4 位数字',
        },
      ],
    },
    {
      id: 'f-emp-department',
      name: 'department',
      type: 'select',
      label: '部门',
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
      id: 'f-emp-hire-date',
      name: 'hireDate',
      type: 'date',
      label: '入职日期',
      props: { placeholder: '请选择日期' },
      rules: [{ type: 'required' }],
    },
    {
      id: 'f-emp-emergency',
      name: 'hasEmergency',
      type: 'switch',
      label: '有紧急联系人',
      props: {},
      rules: [],
      layout: { span: 2 },
    },
    {
      id: 'f-emp-emergency-name',
      name: 'emergencyName',
      type: 'input',
      label: '紧急联系人',
      props: { placeholder: '姓名' },
      rules: [{ type: 'required' }],
      visibleWhen: { field: 'hasEmergency', op: 'eq', value: true },
    },
    {
      id: 'f-emp-emergency-phone',
      name: 'emergencyPhone',
      type: 'input',
      label: '联系电话',
      props: { placeholder: '11 位手机号' },
      rules: [
        { type: 'required' },
        { type: 'pattern', value: '^1\\d{10}$', message: '请输入 11 位手机号' },
      ],
      visibleWhen: { field: 'hasEmergency', op: 'eq', value: true },
    },
    {
      id: 'f-emp-divider',
      name: 'experienceDivider',
      type: 'divider',
      label: '工作经历',
      props: {},
      rules: [],
      layout: { span: 2 },
    },
    {
      id: 'f-emp-experiences',
      name: 'experiences',
      type: 'subform',
      label: '工作经历',
      props: { columns: 2 },
      rules: [],
      layout: { span: 2 },
      children: [
        {
          id: 'f-emp-company',
          name: 'company',
          type: 'input',
          label: '公司名称',
          props: { placeholder: '例如：某某科技' },
          rules: [{ type: 'required' }],
        },
        {
          id: 'f-emp-title',
          name: 'title',
          type: 'input',
          label: '职位',
          props: { placeholder: '例如：前端工程师' },
          rules: [{ type: 'required' }],
        },
        {
          id: 'f-emp-start',
          name: 'startDate',
          type: 'date',
          label: '开始日期',
          props: { placeholder: '请选择日期' },
          rules: [{ type: 'required' }],
        },
        {
          id: 'f-emp-end',
          name: 'endDate',
          type: 'date',
          label: '结束日期',
          props: { placeholder: '至今可留空' },
          rules: [],
        },
      ],
    },
    {
      id: 'f-emp-resume',
      name: 'resume',
      type: 'upload',
      label: '简历附件',
      props: { accept: '.pdf,.doc,.docx', maxSizeMB: 5, maxCount: 1 },
      rules: [],
      layout: { span: 2 },
    },
  ],
}
