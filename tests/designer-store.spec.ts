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
