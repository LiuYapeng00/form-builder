/**
 * 设计器状态（T13，设计见 docs/一期-技术方案.md §6）
 *
 * 三条约束：
 * 1. 所有写操作必须走 commit()，由它统一压快照，否则撤销重做会漏记录；
 * 2. 快照必须是深拷贝，直接存 schema 引用等于没存；
 * 3. 选整树快照而不是 patch 增量：subform 嵌套下做路径 diff 成本高于收益。
 */
import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { createField } from '@/core/schema/factory'
import type { FieldNode, FieldType, FormSchema } from '@/core/schema/types'
import { leaveSampleSchema } from '@/samples/leave'

/** 历史上限：100 字段 schema ≈ 50KB，50 份 ≈ 2.5MB，见 §6 */
export const HISTORY_LIMIT = 50

export interface DesignerHistory {
  /** 改动前的整树快照，末尾是最新一步 */
  past: FormSchema[]
  /** 撤销出来的快照；产生新操作即失效（T20 接 undo/redo） */
  future: FormSchema[]
}

/** 递归查找：子表单里的字段也要能选中，所以不能只看顶层 */
function findField(fields: FieldNode[], id: string): FieldNode | undefined {
  for (const field of fields) {
    if (field.id === id) return field
    const hit = field.children ? findField(field.children, id) : undefined
    if (hit) return hit
  }
  return undefined
}

export const useDesignerStore = defineStore('designer', () => {
  // T13 先用内置样例填充画布，方便验证选中态；T25 换成模板选择 / 草稿恢复
  const schema = ref<FormSchema>(structuredClone(leaveSampleSchema))
  const selectedId = ref<string | null>(null)
  const history = ref<DesignerHistory>({ past: [], future: [] })

  const selectedField = computed(() =>
    selectedId.value ? findField(schema.value.fields, selectedId.value) : undefined,
  )

  function select(id: string | null): void {
    selectedId.value = id
  }

  /** 点击物料：造一个新节点追加到根画布，并选中它方便接着改属性 */
  function addField(type: FieldType): void {
    const field = createField(type)
    commit((draft) => {
      draft.fields.push(field)
    })
    select(field.id)
  }

  function commit(mutator: (draft: FormSchema) => void): void {
    // 快照必须在 mutator 之前拍；toRaw 是必需的：structuredClone 克隆不了 Vue 的 Proxy
    const snapshot = structuredClone(toRaw(schema.value))
    mutator(schema.value)

    history.value.past.push(snapshot)
    if (history.value.past.length > HISTORY_LIMIT) history.value.past.shift()
    // 产生新操作后，之前撤销出来的重做路径就失效了
    history.value.future = []

    // 字段被删掉时清掉悬空选中，避免属性面板指向不存在的节点
    if (selectedId.value && !findField(schema.value.fields, selectedId.value)) {
      selectedId.value = null
    }
  }

  return { schema, selectedId, history, selectedField, select, addField, commit }
})
