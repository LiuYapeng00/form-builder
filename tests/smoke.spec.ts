import { describe, expect, it } from 'vitest'
import { FIELD_TYPES } from '@/core/schema/types'

// 脚手架自检：验证 vitest + tsconfig paths(@) + core 引用链路是通的。
// 真正的业务单测从 T05 开始补（zod / path / validate / visibility）。
describe('core 脚手架', () => {
  it('字段类型注册表可用', () => {
    expect(FIELD_TYPES.length).toBe(11)
    expect(FIELD_TYPES).toContain('subform')
    expect(new Set(FIELD_TYPES).size).toBe(FIELD_TYPES.length)
  })
})
