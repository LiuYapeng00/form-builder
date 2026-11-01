import { describe, expect, it } from 'vitest'
import { checkUploadFiles } from '@/core/engine/upload'

const MB = 1024 * 1024

describe('checkUploadFiles', () => {
  it('合法文件全部接受，返回文件名', () => {
    const result = checkUploadFiles(
      [
        { name: 'a.pdf', size: 1 * MB, type: 'application/pdf' },
        { name: 'b.png', size: 2 * MB, type: 'image/png' },
      ],
      [],
      { accept: '.pdf,.png', maxSizeMB: 5, maxCount: 3 },
    )

    expect(result.accepted).toEqual(['a.pdf', 'b.png'])
    expect(result.rejected).toEqual([])
  })

  it('扩展名不在 accept 里被拒绝', () => {
    const result = checkUploadFiles(
      [{ name: 'virus.exe', size: 10, type: 'application/octet-stream' }],
      [],
      { accept: '.pdf,.png', maxSizeMB: 5, maxCount: 1 },
    )

    expect(result.accepted).toEqual([])
    expect(result.rejected).toEqual([{ name: 'virus.exe', reason: '类型不支持' }])
  })

  it('accept 支持 MIME 通配符 image/*', () => {
    const result = checkUploadFiles(
      [
        { name: 'photo.jpg', size: 10, type: 'image/jpeg' },
        { name: 'doc.pdf', size: 10, type: 'application/pdf' },
      ],
      [],
      { accept: 'image/*', maxCount: 5 },
    )

    expect(result.accepted).toEqual(['photo.jpg'])
    expect(result.rejected[0]?.name).toBe('doc.pdf')
  })

  it('超过大小上限被拒绝', () => {
    const result = checkUploadFiles(
      [{ name: 'big.pdf', size: 6 * MB, type: 'application/pdf' }],
      [],
      { maxSizeMB: 5, maxCount: 1 },
    )

    expect(result.rejected).toEqual([{ name: 'big.pdf', reason: '超过 5MB' }])
  })

  it('超出 maxCount 的文件被拒绝，existing 也计入数量', () => {
    const result = checkUploadFiles(
      [
        { name: 'new1.pdf', size: 10 },
        { name: 'new2.pdf', size: 10 },
      ],
      ['old.pdf'],
      { maxCount: 2 },
    )

    expect(result.accepted).toEqual(['new1.pdf'])
    expect(result.rejected).toEqual([{ name: 'new2.pdf', reason: '最多 2 个文件' }])
  })

  it('同名文件不重复添加', () => {
    const result = checkUploadFiles([{ name: 'a.pdf', size: 10 }], ['a.pdf'], { maxCount: 5 })

    expect(result.accepted).toEqual([])
    expect(result.rejected).toEqual([{ name: 'a.pdf', reason: '已添加过' }])
  })

  it('不传 accept / maxSizeMB 时类型和大小都不限', () => {
    const result = checkUploadFiles(
      [{ name: 'anything.bin', size: 999 * MB, type: 'application/octet-stream' }],
      [],
      { maxCount: 1 },
    )

    expect(result.accepted).toEqual(['anything.bin'])
  })
})
