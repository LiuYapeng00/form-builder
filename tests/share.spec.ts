import { describe, expect, it } from 'vitest'
import { compressToEncodedURIComponent } from 'lz-string'
import { createEmptySchema, createField } from '@/core/schema/factory'
import { SHARE_URL_LIMIT, buildShareUrl, decodeShare, encodeShare } from '@/core/share'
import { leaveSampleSchema } from '@/samples/leave'

function randomText(length: number): string {
  let seed = 123456789
  let out = ''
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648
    out += String.fromCharCode(33 + (seed % 90))
  }
  return out
}

describe('encodeShare / decodeShare', () => {
  it('样例 Schema 编码后能完整还原（含子表单）', () => {
    const encoded = encodeShare(leaveSampleSchema)
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return

    const decoded = decodeShare(encoded.data)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.data).toEqual(leaveSampleSchema)
  })

  it('超过 6000 字符时明确失败，不静默截断', () => {
    const schema = createEmptySchema('大表单')
    schema.fields = [
      {
        ...createField('input', { name: 'big' }),
        // 伪随机字符压缩率低，确保越过上限
        label: randomText(8000),
      },
    ]

    const encoded = encodeShare(schema)
    expect(encoded.ok).toBe(false)
    if (!encoded.ok) {
      expect(encoded.reason).toBe('too-long')
      expect(encoded.length).toBeGreaterThan(SHARE_URL_LIMIT)
    }
  })

  it('空值 / 坏数据 / 不合法 Schema 分别给出原因', () => {
    expect(decodeShare(undefined)).toEqual({ ok: false, reason: 'empty' })

    expect(decodeShare('%%%not-valid%%%').ok).toBe(false)

    const invalid = compressToEncodedURIComponent(JSON.stringify({ schemaVersion: 1 }))
    const result = decodeShare(invalid)
    expect(result).toEqual({ ok: false, reason: 'invalid', issues: expect.any(Array) })
    if (!result.ok && result.reason === 'invalid') {
      expect(result.issues.some((issue) => issue.path === 'id')).toBe(true)
    }
  })

  it('buildShareUrl 丢掉旧 hash，把 query 放在 # 之后', () => {
    expect(buildShareUrl('https://example.com/form/#/', 'ABC')).toBe(
      'https://example.com/form/#/f?d=ABC',
    )
    expect(buildShareUrl('http://localhost:5173/', 'ABC')).toBe('http://localhost:5173/#/f?d=ABC')
  })
})
