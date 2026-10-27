import { describe, expect, it } from 'vitest'
import {
  createLocalSubmitAdapter,
  SUBMISSIONS_KEY,
  type KeyValueStorage,
} from '@/core/engine/submit'
import type { SubmitPayload } from '@/core/schema/types'

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & {
  data: Record<string, string>
} {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
  }
}

function payload(id: string): SubmitPayload {
  return {
    schemaId: id,
    schemaVersion: 1,
    data: { name: '张三' },
    submittedAt: '2026-10-27T00:00:00.000Z',
  }
}

describe('createLocalSubmitAdapter', () => {
  it('首次提交写入数组', async () => {
    const storage = memoryStorage()
    const adapter = createLocalSubmitAdapter(storage)

    await expect(adapter.submit(payload('form-a'))).resolves.toEqual({ ok: true })

    const raw = storage.data[SUBMISSIONS_KEY]
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw ?? '[]')).toEqual([payload('form-a')])
  })

  it('追加提交而不是覆盖历史', async () => {
    const storage = memoryStorage()
    const adapter = createLocalSubmitAdapter(storage)

    await adapter.submit(payload('form-a'))
    await adapter.submit(payload('form-b'))

    expect(JSON.parse(storage.data[SUBMISSIONS_KEY] ?? '[]')).toHaveLength(2)
  })

  it('自定义 key', async () => {
    const storage = memoryStorage()
    const adapter = createLocalSubmitAdapter(storage, 'fb:test')

    await adapter.submit(payload('form-a'))
    expect(storage.data['fb:test']).toBeTruthy()
    expect(storage.data[SUBMISSIONS_KEY]).toBeUndefined()
  })

  it('localStorage 里是坏 JSON 时重置为空列表，不阻断新提交', async () => {
    const storage = memoryStorage({ [SUBMISSIONS_KEY]: '{not-json' })
    const adapter = createLocalSubmitAdapter(storage)

    await expect(adapter.submit(payload('form-a'))).resolves.toEqual({ ok: true })
    expect(JSON.parse(storage.data[SUBMISSIONS_KEY] ?? '[]')).toEqual([payload('form-a')])
  })

  it('存储写入抛错时返回可读错误而不是 reject', async () => {
    const storage: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }

    await expect(createLocalSubmitAdapter(storage).submit(payload('form-a'))).resolves.toEqual({
      ok: false,
      error: 'QuotaExceededError',
    })
  })
})
