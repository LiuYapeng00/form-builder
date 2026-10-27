/**
 * 提交适配器（docs/一期-技术方案.md §7、任务清单 T12）
 *
 * core 不直接访问 localStorage / fetch：
 * 存储能力由调用方注入，二期换真接口时只替换适配器，页面调用零改动。
 * 一期实现把 SubmitPayload 追加进一个数组，便于在 DevTools 里直接验收。
 */
import type { SubmitAdapter, SubmitPayload } from '../schema/types'

/** 最小存储接口，window.localStorage 天然满足；测试里可以传内存实现 */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const SUBMISSIONS_KEY = 'fb:submissions'

/** 读取历史提交；坏数据（手改坏了 localStorage）不能让之后的提交全部失败 */
function readHistory(raw: string | null): SubmitPayload[] {
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SubmitPayload[]) : []
  } catch {
    return []
  }
}

export function createLocalSubmitAdapter(
  storage: KeyValueStorage,
  key = SUBMISSIONS_KEY,
): SubmitAdapter {
  return {
    async submit(payload) {
      try {
        const history = readHistory(storage.getItem(key))
        history.push(payload)
        storage.setItem(key, JSON.stringify(history))
        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : '提交失败：本地存储不可写',
        }
      }
    },
  }
}
