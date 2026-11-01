import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { toRaw } from 'vue'
import { createEmptySchema, createField } from '@/core/schema/factory'
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

describe('updateField', () => {
  it('一次编辑写回多个键，只压一条历史', () => {
    const store = useDesignerStore()
    const target = store.schema.fields[0]!
    const originalLabel = target.label
    const historyBefore = store.history.past.length

    store.updateField(target.id, (field) => {
      field.label = '新标题'
      field.props.placeholder = '请输入新内容'
      field.layout = { span: 2 }
    })

    const after = store.schema.fields[0]!
    expect(after.label).toBe('新标题')
    expect(after.props.placeholder).toBe('请输入新内容')
    expect(after.layout?.span).toBe(2)
    expect(store.history.past).toHaveLength(historyBefore + 1)
    // 快照存的是改动前的值
    expect(store.history.past.at(-1)?.fields[0]?.label).toBe(originalLabel)
  })

  it('子表单里的字段也能写', () => {
    const store = useDesignerStore()
    const subform = store.schema.fields.find((field) => field.type === 'subform')!
    const child = subform.children![0]!

    store.updateField(child.id, (field) => {
      field.label = '子字段新标题'
      field.rules = [{ type: 'required' }]
    })

    const after = store.schema.fields.find((field) => field.id === subform.id)!
    const updated = after.children!.find((field) => field.id === child.id)!
    expect(updated.label).toBe('子字段新标题')
    expect(updated.rules).toEqual([{ type: 'required' }])
  })

  it('未知 id 直接忽略，不产生历史', () => {
    const store = useDesignerStore()
    const historyBefore = store.history.past.length

    store.updateField('not-exist', (field) => {
      field.label = '不该写进去'
    })

    expect(store.history.past).toHaveLength(historyBefore)
  })
})

describe('siblingsOf', () => {
  it('返回同级字段：根字段给根列表，子表单字段给子列表', () => {
    const store = useDesignerStore()
    const root = store.schema.fields[0]!
    const subform = store.schema.fields.find((field) => field.type === 'subform')!
    const child = subform.children![0]!

    expect(store.siblingsOf(root.id).map((field) => field.id)).toEqual(
      store.schema.fields.map((field) => field.id),
    )
    expect(store.siblingsOf(child.id).map((field) => field.id)).toEqual(
      subform.children!.map((field) => field.id),
    )
  })

  it('未知 id 返回空数组', () => {
    const store = useDesignerStore()
    expect(store.siblingsOf('not-exist')).toEqual([])
  })
})

describe('undo / redo', () => {
  it('逐步撤销再重做，顺序正确', () => {
    const store = useDesignerStore()
    const initial = store.schema.name

    store.commit((draft) => {
      draft.name = '第一步'
    })
    store.commit((draft) => {
      draft.name = '第二步'
    })

    store.undo()
    expect(store.schema.name).toBe('第一步')
    store.undo()
    expect(store.schema.name).toBe(initial)

    store.redo()
    expect(store.schema.name).toBe('第一步')
    store.redo()
    expect(store.schema.name).toBe('第二步')
  })

  it('连续 20 步后逐步撤销结果正确', () => {
    const store = useDesignerStore()
    const initial = store.schema.name

    for (let i = 1; i <= 20; i += 1) {
      store.commit((draft) => {
        draft.name = `第 ${i} 步`
      })
    }

    for (let i = 19; i >= 0; i -= 1) {
      store.undo()
      expect(store.schema.name).toBe(i === 0 ? initial : `第 ${i} 步`)
    }

    expect(store.history.past).toHaveLength(0)
    expect(store.history.future).toHaveLength(20)
  })

  it('空栈时 undo / redo 不改数据', () => {
    const store = useDesignerStore()
    const before = structuredClone(toRaw(store.schema))

    store.undo()
    store.redo()

    expect(structuredClone(toRaw(store.schema))).toEqual(before)
    expect(store.history.past).toHaveLength(0)
    expect(store.history.future).toHaveLength(0)
  })

  it('撤销后字段仍存在则保留选中，被删字段不猜选中', () => {
    const store = useDesignerStore()
    const target = store.schema.fields[0]!

    store.select(target.id)
    store.addField('input')
    store.select(target.id)
    store.undo()
    expect(store.selectedId).toBe(target.id)

    store.removeField(target.id)
    expect(store.selectedId).toBeNull()
    store.undo()
    expect(store.schema.fields.some((field) => field.id === target.id)).toBe(true)
    expect(store.selectedId).toBeNull()
  })

  it('撤销后产生新操作会清空重做栈', () => {
    const store = useDesignerStore()

    store.commit((draft) => {
      draft.name = 'A'
    })
    store.undo()
    expect(store.history.future).toHaveLength(1)

    store.commit((draft) => {
      draft.name = 'B'
    })
    expect(store.history.future).toHaveLength(0)
  })

  it('撤销后继续 commit 不会因代理快照报错', () => {
    const store = useDesignerStore()

    store.commit((draft) => {
      draft.name = 'A'
    })
    store.undo()

    expect(() =>
      store.commit((draft) => {
        draft.name = 'B'
      }),
    ).not.toThrow()
  })
})

describe('loadSchema', () => {
  it('整树替换，清空选中，且可撤销', () => {
    const store = useDesignerStore()
    const target = store.schema.fields[0]!
    store.select(target.id)

    const next = createEmptySchema('导入的表单')
    next.fields = [createField('input', { name: 'imported' })]

    store.loadSchema(next)

    expect(store.schema.name).toBe('导入的表单')
    expect(store.schema.fields).toHaveLength(1)
    expect(store.schema.fields[0]?.name).toBe('imported')
    expect(store.selectedId).toBeNull()
    expect(store.history.past).toHaveLength(1)

    store.undo()
    expect(store.schema.name).toBe('请假申请')
    expect(store.schema.fields.length).toBeGreaterThan(1)
  })

  it('新 schema 没有 submit 时删掉旧文案', () => {
    const store = useDesignerStore()
    expect(store.schema.submit).toBeDefined()

    const next = createEmptySchema('无提交文案')
    delete next.submit

    store.loadSchema(next)

    expect(store.schema.submit).toBeUndefined()
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
