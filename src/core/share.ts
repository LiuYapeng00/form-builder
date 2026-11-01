/**
 * 分享链接编解码（docs/一期-技术方案.md §7、任务清单 T22）
 *
 * 零后端方案：整份 Schema 压缩后放进 hash query（/#/f?d=...）。
 * 两条边界：
 * 1. 编码后超过 6000 字符明确失败，让用户改用 JSON 导入，绝不静默截断；
 * 2. 解码后必须再过 zod，坏链接只报错，不让半截 Schema 进渲染层。
 */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { FormSchema } from './schema/types'
import { parseFormSchema } from './schema/zod'
import type { SchemaIssue } from './schema/zod'

/** GitHub Pages / 聊天工具对超长 URL 不友好，6000 是留了余量的保守值 */
export const SHARE_URL_LIMIT = 6000

export type EncodeShareResult =
  { ok: true; data: string; length: number } | { ok: false; reason: 'too-long'; length: number }

export type DecodeShareResult =
  | { ok: true; data: FormSchema }
  | { ok: false; reason: 'empty' }
  | { ok: false; reason: 'corrupt' }
  | { ok: false; reason: 'invalid'; issues: SchemaIssue[] }

export function encodeShare(schema: FormSchema): EncodeShareResult {
  const data = compressToEncodedURIComponent(JSON.stringify(schema))
  if (data.length > SHARE_URL_LIMIT) return { ok: false, reason: 'too-long', length: data.length }
  return { ok: true, data, length: data.length }
}

export function decodeShare(value: string | null | undefined): DecodeShareResult {
  if (!value) return { ok: false, reason: 'empty' }

  const json = decompressFromEncodedURIComponent(value)
  if (!json) return { ok: false, reason: 'corrupt' }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'corrupt' }
  }

  const result = parseFormSchema(parsed)
  if (!result.ok) return { ok: false, reason: 'invalid', issues: result.issues }
  return { ok: true, data: result.data }
}

/** hash 路由下 query 必须放在 # 之后；baseUrl 里已有的 hash 要丢掉 */
export function buildShareUrl(baseUrl: string, data: string): string {
  return `${baseUrl.split('#')[0]}#/f?d=${data}`
}
