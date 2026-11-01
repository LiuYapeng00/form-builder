/**
 * upload 字段的前端校验（docs/一期-技术方案.md §7 已知限制、任务清单 T24）
 *
 * 一期不做真上传：只在选择文件时做类型 / 大小 / 数量校验，
 * 提交的是文件名数组。放在 core 里是为了让这段规则可单测，
 * 组件只负责把 File 映射成 { name, size, type } 再展示拒绝原因。
 */

/** 只取校验需要的字段，方便测试直接构造，不依赖浏览器的 File */
export interface UploadFileInfo {
  name: string
  size: number
  /** MIME，浏览器拿不到时为空串 */
  type?: string
}

export interface UploadLimits {
  /** 逗号分隔的扩展名或 MIME，如 ".pdf,.png" / "image/*"；为空表示不限 */
  accept?: string
  /** 单文件大小上限（MB）；未设置表示不限 */
  maxSizeMB?: number
  /** 最多文件数；未设置按 1 处理，和字段元数据默认值一致 */
  maxCount?: number
}

export interface UploadRejection {
  name: string
  reason: string
}

export interface UploadCheckResult {
  /** 通过校验、可以追加到模型里的文件名 */
  accepted: string[]
  rejected: UploadRejection[]
}

function matchesAccept(file: UploadFileInfo, accept: string): boolean {
  const tokens = accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
  if (tokens.length === 0) return true

  const name = file.name.toLowerCase()
  const mime = (file.type ?? '').toLowerCase()

  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token)
    if (token.endsWith('/*')) return mime.startsWith(token.slice(0, -1))
    if (token.includes('/')) return mime === token
    // 用户把 ".pdf" 写成 "pdf" 也能用，别让一个点毁掉整个校验
    return name.endsWith(`.${token}`)
  })
}

export function checkUploadFiles(
  files: UploadFileInfo[],
  existing: string[],
  limits: UploadLimits,
): UploadCheckResult {
  const maxCount = Math.max(1, limits.maxCount ?? 1)
  const maxSizeMB = limits.maxSizeMB
  const accept = limits.accept?.trim() ?? ''
  const taken = new Set(existing)

  const accepted: string[] = []
  const rejected: UploadRejection[] = []

  for (const file of files) {
    if (maxSizeMB !== undefined && maxSizeMB > 0 && file.size > maxSizeMB * 1024 * 1024) {
      rejected.push({ name: file.name, reason: `超过 ${maxSizeMB}MB` })
      continue
    }

    if (!matchesAccept(file, accept)) {
      rejected.push({ name: file.name, reason: '类型不支持' })
      continue
    }

    if (taken.has(file.name)) {
      rejected.push({ name: file.name, reason: '已添加过' })
      continue
    }

    if (taken.size >= maxCount) {
      rejected.push({ name: file.name, reason: `最多 ${maxCount} 个文件` })
      continue
    }

    taken.add(file.name)
    accepted.push(file.name)
  }

  return { accepted, rejected }
}
