/**
 * 值路径寻址（docs/一期-技术方案.md §2.5）
 *
 * 表单值统一存在 Record<string, unknown> 里，子表单是对象数组，
 * 所以取值、赋值、删除都用同一套路径语法：
 *   'title'                          → 普通字段
 *   'employees[0].name'              → 子表单行内字段
 *   'employees.0.name'               → 兼容点号下标的写法（el-form 的 prop 串习惯）
 *
 * 三条硬约束：
 * 1. 不抛错：非法路径返回 undefined / false，渲染层不用包 try/catch
 * 2. 不污染原型：__proto__ / constructor / prototype 在解析阶段直接判非法
 * 3. 无副作用之外的行为：set 时按下一个 token 决定补建对象还是数组
 */

export type PathToken = string | number

/** 原型链敏感 key：任何层级出现都视为非法路径，避免 path 注入 */
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const INDEX_PATTERN = /^\d+$/

/**
 * 解析路径，非法返回 null。
 * 纯数字段按数组下标处理（'a.0.b' 与 'a[0].b' 等价），
 * 这样 el-form 的 prop 串与内部寻址可以共用一套逻辑。
 */
export function parsePath(path: string): PathToken[] | null {
  if (typeof path !== 'string' || path.length === 0) return null

  const tokens: PathToken[] = []
  const length = path.length
  let i = 0

  while (i < length) {
    if (path[i] === '.') return null // 首尾多余的点 / 连续点

    if (path[i] === '[') {
      const close = path.indexOf(']', i + 1)
      if (close === -1) return null

      const raw = path.slice(i + 1, close)
      if (!INDEX_PATTERN.test(raw)) return null

      const index = Number(raw)
      // 超出安全整数范围的「下标」只可能是脏数据，补建会退化成怪异的稀疏数组
      if (!Number.isSafeInteger(index)) return null

      tokens.push(index)
      i = close + 1
    } else {
      let end = i
      while (end < length && path[end] !== '.' && path[end] !== '[' && path[end] !== ']') end++

      if (end === i) return null
      const key = path.slice(i, end)
      if (BLOCKED_KEYS.has(key)) return null

      // 纯数字段按数组下标处理，与 'a[0]' 等价；对象上的数字 key 读取时会被 String() 还原
      if (INDEX_PATTERN.test(key) && Number.isSafeInteger(Number(key))) {
        tokens.push(Number(key))
      } else {
        tokens.push(key)
      }
      i = end
    }

    // 段与段之间只允许 '.' 或 '['
    if (i < length) {
      if (path[i] === '.') {
        i++
        // 'a.'、'a..b'、'a.[0]' 都不合法
        if (i === length || path[i] === '.' || path[i] === '[') return null
      } else if (path[i] !== '[') {
        return null
      }
    }
  }

  return tokens.length > 0 ? tokens : null
}

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null
}

/** 读取路径值；任何中间层缺失、类型不符或路径非法都返回 undefined */
export function getByPath(model: unknown, path: string): unknown {
  const tokens = parsePath(path)
  if (!tokens) return undefined

  let current: unknown = model

  for (const token of tokens) {
    if (!isContainer(current)) return undefined

    if (Array.isArray(current)) {
      if (typeof token !== 'number') return undefined
      current = current[token]
    } else {
      current = current[String(token)]
    }
  }

  return current
}

/**
 * 写入路径值，成功返回 true；根节点不可写或路径非法返回 false（不抛错）。
 */
export function setByPath(model: unknown, path: string, value: unknown): boolean {
  const tokens = parsePath(path)
  if (!tokens || !isContainer(model)) return false

  let current: Record<string, unknown> | unknown[] = model

  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i]
    if (token === undefined) return false
    const next = tokens[i + 1]
    if (next === undefined) return false
    if (Array.isArray(current) && typeof token !== 'number') return false

    current = ensureChildContainer(current, token, next)
  }

  const last = tokens[tokens.length - 1]
  if (last === undefined) return false

  return installValue(current, last, value)
}

/** 删除路径值，数组用 splice 保持紧凑；不存在或非法返回 false */
export function deleteByPath(model: unknown, path: string): boolean {
  const tokens = parsePath(path)
  if (!tokens || !isContainer(model)) return false

  let current: Record<string, unknown> | unknown[] = model

  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i]
    if (token === undefined) return false

    const child = Array.isArray(current)
      ? typeof token === 'number'
        ? current[token]
        : undefined
      : current[String(token)]

    if (!isContainer(child)) return false
    current = child
  }

  const last = tokens[tokens.length - 1]
  if (last === undefined) return false

  if (Array.isArray(current)) {
    if (typeof last !== 'number' || last >= current.length) return false
    current.splice(last, 1)
    return true
  }

  const key = String(last)
  if (!Object.prototype.hasOwnProperty.call(current, key)) return false
  return delete current[key]
}

/** 取子容器；不存在（或中间层是基本类型）时按下一个 token 的类型补建 */
function ensureChildContainer(
  parent: Record<string, unknown> | unknown[],
  token: PathToken,
  next: PathToken,
): Record<string, unknown> | unknown[] {
  const existing = Array.isArray(parent)
    ? typeof token === 'number'
      ? parent[token]
      : undefined
    : parent[String(token)]

  if (isContainer(existing)) return existing

  const created: Record<string, unknown> | unknown[] = typeof next === 'number' ? [] : {}
  installValue(parent, token, created)
  return created
}

/** set / 补建容器共用的赋值逻辑：数组只接受数字下标，对象统一转字符串 key */
function installValue(
  container: Record<string, unknown> | unknown[],
  token: PathToken,
  value: unknown,
): boolean {
  if (Array.isArray(container)) {
    if (typeof token !== 'number') return false
    container[token] = value
    return true
  }

  container[String(token)] = value
  return true
}
