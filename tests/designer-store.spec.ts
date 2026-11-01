import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { toRaw } from 'vue'
import { HISTORY_LIMIT, useDesignerStore } from '@/stores/designer'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('选中态', () => {
  it('初始未选中', () => {
    const store = useDesignerStore()
    expect(store.selectedId).toBeNull()
    expect(store.selectedField).toBeUndefined()
  })

  it('可在字段之间切换', () => {
    const store = useDesignerStore()
    const first = store.schema.fields[0]!
    const second = store.schema.fields[1]!

    store.select(first.id)
    expect(store.selectedField?.id).toBe(first.id)

    store.select(second.id)
    expect(store.selectedField?.id).toBe(second.id)

    store.select(null)
    expect(store.selectedField).toBeUndefined()
  })

  it('子表单里的字段也能选中', () => {
    const store = useDesignerStore()
    const subform = store.schema.fields.find((field) => field.type === 'subform')
    const childId = subform?.children?.[0]?.id
    expect(childId).toBeTruthy()

    store.select(childId!)
    expect(store.selectedField?.id).toBe(childId)
  })
})

describe('addField', () => {
  it('追加到末尾并自动选中，id / name 唯一', () => {
    const store = useDesignerStore()
    const before = store.schema.fields.length

    store.addField('input')
    store.addField('select')

    const added = store.schema.fields.slice(-2)
    expect(store.schema.fields).toHaveLength(before + 2)
    expect(added[0]!.type).toBe('input')
    expect(added[0]!.id).not.toBe(added[1]!.id)
    expect(added[0]!.name).not.toBe(added[1]!.name)
    expect(store.selectedId).toBe(added[1]!.id)
  })

  it('每次新增的 props 互不共享', () => {
    const store = useDesignerStore()
    store.addField('select')
    store.addField('select')

    const [first, second] = store.schema.fields.slice(-2)
    first!.props.options!.push({ label: '选项三', value: 'option3' })

    expect(second!.props.options).toHaveLength(2)
  })

  it('每次新增都压一条历史', () => {
    const store = useDesignerStore()
    const before = store.history.past.length

    store.addField('input')

    expect(store.history.past).toHaveLength(before + 1)
  })
})

describe('画布操作', () => {
  it('复制字段：插在原字段后面、id 唯一、引用不共享', () => {
    const store = useDesignerStore()
    store.addField('select')

    const source = store.schema.fields.at(-1)!
    store.duplicateField(source.id)

    const fields = store.schema.fields
    const copy = fields.at(-1)!
    expect(fields.at(-2)?.id).toBe(source.id)
    expect(copy.id).not.toBe(source.id)
    expect(copy.name).not.toBe(source.name)
    expect(store.selectedId).toBe(copy.id)

    copy.props.options![0]!.label = '改坏了'
    expect(source.props.options?.[0]?.label).toBe('选项一')
  })

  it('复制子表单：子字段 id 也全部换新', () => {
    const store = useDesignerStore()
    const subform = store.schema.fields.find((field) => field.type === 'subform')!
    const childIds = subform.children!.map((child) => child.id)

    store.duplicateField(subform.id)

    const copy = store.schema.fields.at(-1)!
    expect(copy.children).toHaveLength(childIds.length)
    expect(copy.children!.every((child) => !childIds.includes(child.id))).toBe(true)
  })

  it('删除顶层字段并清空选中', () => {
    const store = useDesignerStore()
    const target = store.schema.fields[0]!

    store.select(target.id)
    store.removeField(target.id)

    expect(store.schema.fields.some((field) => field.id === target.id)).toBe(false)
    expect(store.selectedId).toBeNull()
  })

  it('删除子表单里的字段', () => {
    const store = useDesignerStore()
    const subform = store.schema.fields.find((field) => field.type === 'subform')!
    const childId = subform.children![0]!.id

    store.removeField(childId)

    const after = store.schema.fields.find((field) => field.type === 'subform')!
    expect(after.children?.some((child) => child.id === childId)).toBe(false)
  })

  it('上移 / 下移只在同一层内交换，边界不产生历史', () => {
    const store = useDesignerStore()
    const first = store.schema.fields[0]!
    const second = store.schema.fields[1]!
    const historyBefore = store.history.past.length

    store.moveField(first.id, -1)
    expect(store.history.past).toHaveLength(historyBefore)

    store.moveField(first.id, 1)
    expect(store.schema.fields[0]?.id).toBe(second.id)
    expect(store.schema.fields[1]?.id).toBe(first.id)
    expect(store.history.past).toHaveLength(historyBefore + 1)
  })

  it('拖拽回传的代理数组写回后仍能继续 commit（DataCloneError 回归）', () => {
    const store = useDesignerStore()
    // 模拟拖拽库回传的数组：元素是从响应式数组读出来的 Proxy
    const fromDraggable = [...store.schema.fields].reverse()

    store.replaceFields(fromDraggable)
    expect(store.schema.fields.map((field) => field.id)).toEqual(
      fromDraggable.map((field) => field.id),
    )

    // 下一次 commit 会 structuredClone 整棵树；若写回的是 Proxy 这里会抛错
    expect(() => store.commit((draft) => (draft.name = '拖拽后继续编辑'))).not.toThrow()
  })
})

describe('replaceChildren', () => {
  it('写回子表单的子字段顺序，只影响该子表单', () => {
    const store = useDesignerStore()
    const subform = store.schema.fields.find((field) => field.type === 'subform')!
    const rootIds = store.schema.fields.map((field) => field.id)
    const reversed = [...subform.children!].reverse()

    store.replaceChildren(subform.id, reversed)

    const after = store.schema.fields.find((field) => field.id === subform.id)!
    expect(after.children?.map((child) => child.id)).toEqual(reversed.map((child) => child.id))
    expect(store.schema.fields.map((field) => field.id)).toEqual(rootIds)
  })

  it('代理元素写回后仍能继续 commit（DataCloneError 回归）', () => {
    const store = useDesignerStore()
    const subform = store.schema.fields.find((field) => field.type === 'subform')!
    const fromDraggable = [...subform.children!].reverse()

    store.replaceChildren(subform.id, fromDraggable)

    expect(() => store.commit((draft) => (draft.name = '子表单拖拽后继续编辑'))).not.toThrow()
  })

  it('父节点不存在或不是子表单时忽略，不产生历史', () => {
    const store = useDesignerStore()
    const plain = store.schema.fields.find((field) => field.type !== 'subform')!
    const historyBefore = store.history.past.length

    store.replaceChildren('not-exist', [])
    store.replaceChildren(plain.id, [])

    expect(store.history.past).toHaveLength(historyBefore)
    expect(store.schema.fields.some((field) => field.id === plain.id)).toBe(true)
  })
})

describe('commit', () => {
  it('压入改动前的整树快照', () => {
    const store = useDesignerStore()
    const before = store.schema.name

    store.commit((draft) => {
      draft.name = '改过的名字'
    })

    expect(store.schema.name).toBe('改过的名字')
    expect(store.history.past).toHaveLength(1)
    expect(store.history.past[0]?.name).toBe(before)
  })

  it('快照是深拷贝，后续改动不会污染历史', () => {
    const store = useDesignerStore()
    const originalLabel = store.schema.fields[0]!.label

    store.commit((draft) => {
      draft.fields[0]!.label = '第一次'
    })
    store.commit((draft) => {
      draft.fields[0]!.label = '第二次'
    })

    expect(store.history.past[0]?.fields[0]?.label).toBe(originalLabel)
    expect(store.history.past[1]?.fields[0]?.label).toBe('第一次')
  })

  it('超过上限丢弃最旧的快照', () => {
    const store = useDesignerStore()

    for (let i = 1; i <= HISTORY_LIMIT + 10; i += 1) {
      store.commit((draft) => {
        draft.name = `第 ${i} 次`
      })
    }

    expect(store.history.past).toHaveLength(HISTORY_LIMIT)
    // 快照是"改动前"的状态：最早保留的一份对应第 11 次提交之前
    expect(store.history.past[0]?.name).toBe('第 10 次')
    expect(store.history.past.at(-1)?.name).toBe(`第 ${HISTORY_LIMIT + 9} 次`)
  })

  it('产生新操作后清空 future', () => {
    const store = useDesignerStore()

    // T20 的 undo 会把快照放进 future，这里直接构造该状态验证清理职责
    store.history.future.push(structuredClone(toRaw(store.schema)))
    store.commit((draft) => {
      draft.name = '新操作'
    })

    expect(store.history.future).toEqual([])
  })

  it('删掉选中的字段后清空 selectedId', () => {
    const store = useDesignerStore()
    const target = store.schema.fields[0]!

    store.select(target.id)
    store.commit((draft) => {
      draft.fields = draft.fields.filter((field) => field.id !== target.id)
    })

    expect(store.selectedId).toBeNull()
  })
})
