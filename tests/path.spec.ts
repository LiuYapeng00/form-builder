import { describe, expect, it } from 'vitest'
import { deleteByPath, getByPath, parsePath, setByPath } from '@/core/engine/path'

function makeModel() {
  return {
    title: '请假申请',
    employees: [
      { name: '张三', tags: ['A', 'B'] },
      { name: '李四', tags: [] },
    ],
    nested: { deep: { value: 42 } },
  }
}

describe('getByPath', () => {
  it('读取深层对象', () => {
    expect(getByPath(makeModel(), 'nested.deep.value')).toBe(42)
  })

  it('读取数组下标', () => {
    expect(getByPath(makeModel(), 'employees[0].name')).toBe('张三')
    expect(getByPath(makeModel(), 'employees[1].tags')).toEqual([])
  })

  it('兼容点号数字下标（Element Plus 的 prop 串习惯）', () => {
    expect(getByPath(makeModel(), 'employees.1.name')).toBe('李四')
  })

  it('路径不存在时返回 undefined 而不是抛错', () => {
    expect(getByPath(makeModel(), 'nested.missing.value')).toBeUndefined()
    expect(getByPath(makeModel(), 'nested.deep.value.deeper')).toBeUndefined()
  })

  it('中间层为 null / 基本类型时返回 undefined', () => {
    expect(getByPath({ a: null }, 'a.b')).toBeUndefined()
    expect(getByPath({ a: 1 }, 'a.b')).toBeUndefined()
    expect(getByPath({ a: '1' }, 'a.length')).toBeUndefined()
  })

  it('数组越界或非数字下标返回 undefined', () => {
    expect(getByPath(makeModel(), 'employees[9].name')).toBeUndefined()
    expect(getByPath(makeModel(), 'employees[name]')).toBeUndefined()
    expect(getByPath(makeModel(), 'employees.length')).toBeUndefined()
  })

  it('根节点为 null / undefined / 非对象时安全返回', () => {
    expect(getByPath(null, 'a.b')).toBeUndefined()
    expect(getByPath(undefined, 'a')).toBeUndefined()
    expect(getByPath('text', 'length')).toBeUndefined()
    expect(getByPath(1, 'a')).toBeUndefined()
  })

  it('非法路径返回 undefined 且不抛错', () => {
    const model = makeModel()
    for (const path of [
      '',
      '.a',
      'a.',
      'a..b',
      'a[',
      'a[]',
      'a[-1]',
      'a[1.5]',
      'a]',
      'a[0',
      'a.b]',
    ]) {
      expect(() => getByPath(model, path)).not.toThrow()
      expect(getByPath(model, path), path).toBeUndefined()
    }
  })

  it('拒绝原型链路径', () => {
    expect(getByPath({}, '__proto__')).toBeUndefined()
    expect(getByPath({}, 'a.constructor.prototype')).toBeUndefined()
    expect(getByPath(makeModel(), 'employees[0].__proto__')).toBeUndefined()
  })

  it('非字符串 path 不抛错', () => {
    expect(getByPath({ a: 1 }, null as unknown as string)).toBeUndefined()
    expect(getByPath({ a: 1 }, 1 as unknown as string)).toBeUndefined()
  })
})

describe('setByPath', () => {
  it('写入深层对象并保留兄弟属性', () => {
    const model: Record<string, unknown> = makeModel()
    expect(setByPath(model, 'nested.deep.value', 7)).toBe(true)
    expect(model.nested).toEqual({ deep: { value: 7 } })
    expect(model.title).toBe('请假申请')
  })

  it('路径不存在时按需补建对象与数组', () => {
    const model: Record<string, unknown> = {}
    expect(setByPath(model, 'a.b.c', 1)).toBe(true)
    expect(setByPath(model, 'list[0].name', '张三')).toBe(true)
    expect(setByPath(model, 'grid[0][0]', 'x')).toBe(true)

    expect(model).toEqual({
      a: { b: { c: 1 } },
      list: [{ name: '张三' }],
      grid: [['x']],
    })
  })

  it('更新已有数组元素而不改变长度', () => {
    const model: Record<string, unknown> = makeModel()
    expect(setByPath(model, 'employees[1].name', '王五')).toBe(true)
    const employees = model.employees as { name: string }[]
    expect(employees).toHaveLength(2)
    expect(employees[1]?.name).toBe('王五')
    expect(employees[0]?.name).toBe('张三')
  })

  it('下标超出长度时扩容', () => {
    const model: Record<string, unknown> = { list: ['a'] }
    expect(setByPath(model, 'list[3]', 'd')).toBe(true)
    expect(model.list).toEqual(['a', undefined, undefined, 'd'])
  })

  it('中间层是基本类型时用容器覆盖', () => {
    const model: Record<string, unknown> = { a: 1 }
    expect(setByPath(model, 'a.b', 2)).toBe(true)
    expect(model.a).toEqual({ b: 2 })
  })

  it('对 null / 非对象根节点返回 false', () => {
    expect(setByPath(null, 'a', 1)).toBe(false)
    expect(setByPath(undefined, 'a', 1)).toBe(false)
    expect(setByPath('x', 'a', 1)).toBe(false)
  })

  it('非法路径返回 false 且不修改数据', () => {
    const model: Record<string, unknown> = { a: {} }
    for (const path of ['', '.a', 'a..b', 'a[', 'a[-1]']) {
      expect(setByPath(model, path, 1), path).toBe(false)
    }
    expect(model).toEqual({ a: {} })
  })

  it('拒绝通过 path 污染原型', () => {
    const model: Record<string, unknown> = {}
    expect(setByPath(model, '__proto__.polluted', 'yes')).toBe(false)
    expect(setByPath(model, 'a.constructor.prototype.polluted', 'yes')).toBe(false)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.prototype).not.toHaveProperty('polluted')
  })
})

describe('deleteByPath', () => {
  it('删除对象属性', () => {
    const model = makeModel()
    expect(deleteByPath(model, 'nested.deep.value')).toBe(true)
    expect(model.nested.deep).toEqual({})
  })

  it('删除数组元素使用 splice，不留下空洞', () => {
    const model = makeModel()
    expect(deleteByPath(model, 'employees[0]')).toBe(true)
    expect(model.employees).toHaveLength(1)
    expect(model.employees[0]?.name).toBe('李四')
  })

  it('删除嵌套数组元素', () => {
    const model = makeModel()
    expect(deleteByPath(model, 'employees[0].tags[0]')).toBe(true)
    expect(model.employees[0]?.tags).toEqual(['B'])
  })

  it('路径或 key 不存在时返回 false', () => {
    const model = makeModel()
    expect(deleteByPath(model, 'nested.missing.value')).toBe(false)
    expect(deleteByPath(model, 'nested.deep.missing')).toBe(false)
    expect(deleteByPath(model, 'employees[9]')).toBe(false)
    expect(deleteByPath(model, 'title.length')).toBe(false)
  })

  it('非法路径 / 非对象根节点返回 false', () => {
    expect(deleteByPath(null, 'a')).toBe(false)
    expect(deleteByPath('x', 'a')).toBe(false)
    expect(deleteByPath(makeModel(), '')).toBe(false)
    expect(deleteByPath(makeModel(), 'a..b')).toBe(false)
  })

  it('拒绝删除原型链上的属性', () => {
    expect(deleteByPath({}, '__proto__')).toBe(false)
    expect(deleteByPath({}, 'constructor.prototype')).toBe(false)
    expect(Object.prototype).not.toHaveProperty('polluted')
  })
})

describe('parsePath', () => {
  it('拆成字符串与数字 token', () => {
    expect(parsePath('employees[0].name')).toEqual(['employees', 0, 'name'])
    expect(parsePath('a.0.b')).toEqual(['a', 0, 'b'])
    expect(parsePath('[0].name')).toEqual([0, 'name'])
  })

  it('允许中文与特殊字符 key', () => {
    expect(parsePath('员工[0].姓名')).toEqual(['员工', 0, '姓名'])
    expect(parsePath('a-b_c')).toEqual(['a-b_c'])
  })

  it('非法路径返回 null', () => {
    for (const path of ['', '.a', 'a.', 'a..b', 'a[', 'a[]', 'a[1.5]', 'a[-1]', 'a[0]b', 'a.[0]']) {
      expect(parsePath(path), path).toBeNull()
    }
  })

  it('拒绝对原型链敏感的 token', () => {
    for (const path of ['__proto__', 'a.__proto__.b', 'constructor', 'a.prototype.b']) {
      expect(parsePath(path), path).toBeNull()
    }
  })
})

describe('get / set / delete 往返', () => {
  it('set 之后 get 能取回，delete 之后又消失', () => {
    const model: Record<string, unknown> = {}
    setByPath(model, 'form.rows[2].name', '王五')
    expect(getByPath(model, 'form.rows[2].name')).toBe('王五')
    expect(deleteByPath(model, 'form.rows[2].name')).toBe(true)
    expect(getByPath(model, 'form.rows[2].name')).toBeUndefined()
    expect(getByPath(model, 'form.rows')).toHaveLength(3)
  })
})
