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
import { cloneField, createField } from '@/core/schema/factory'
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

/** 字段在树中的位置：父级数组 + 下标 + 节点本身 */
interface FieldLocation {
  siblings: FieldNode[]
  index: number
  field: FieldNode
}

/** 递归查找字段位置：删除 / 复制 / 排序都要先定位到它的兄弟数组 */
function locateField(fields: FieldNode[], id: string): FieldLocation | undefined {
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]!
    if (field.id === id) return { siblings: fields, index, field }

    const hit = field.children ? locateField(field.children, id) : undefined
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
    selectedId.value ? locateField(schema.value.fields, selectedId.value)?.field : undefined,
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

  /**
   * 拖拽后写回根字段顺序（T16）
   *
   * vue-draggable-plus 对 ref/computed 模型是"生成新数组再赋值"，
   * 所以这里拿到的 next 是全新数组，快照仍在赋值前拍，历史不会漏。
   * 但数组元素是响应式代理，必须 toRaw 后写回：否则下一次 structuredClone 会抛 DataCloneError。
   */
  function replaceFields(next: FieldNode[]): void {
    commit((draft) => {
      draft.fields = next.map((field) => toRaw(field))
    })
  }

  /**
   * 拖拽后写回子表单的子字段顺序（T17）
   *
   * 与 replaceFields 同理：回传数组元素是响应式代理，必须 toRaw，
   * 否则下一次 structuredClone 会抛 DataCloneError。
   * 父节点不存在或没有 children（不是子表单）时直接忽略，避免误改。
   */
  function replaceChildren(parentId: string, next: FieldNode[]): void {
    if (!locateField(schema.value.fields, parentId)?.field.children) return

    commit((draft) => {
      const parent = locateField(draft.fields, parentId)?.field
      if (!parent?.children) return
      parent.children = next.map((child) => toRaw(child))
    })
  }

  /** 删除字段（含子表单内的字段）；不存在的 id 直接忽略，不产生空历史 */
  function removeField(id: string): void {
    if (!locateField(schema.value.fields, id)) return

    commit((draft) => {
      const location = locateField(draft.fields, id)
      if (location) location.siblings.splice(location.index, 1)
    })
  }

  /** 复制字段并插到原字段后面；深拷贝 + 全层级新 id，见 core/schema/factory.cloneField */
  function duplicateField(id: string): void {
    const source = locateField(schema.value.fields, id)
    if (!source) return

    // locateField 返回的是响应式代理，structuredClone 只认 raw 对象
    const copy = cloneField(toRaw(source.field))

    commit((draft) => {
      const location = locateField(draft.fields, id)
      if (location) location.siblings.splice(location.index + 1, 0, copy)
    })
    select(copy.id)
  }

  /** 上移 / 下移一位；到边界时直接返回，避免产生没有变化的历史记录 */
  function moveField(id: string, offset: -1 | 1): void {
    const source = locateField(schema.value.fields, id)
    if (!source) return

    const target = source.index + offset
    if (target < 0 || target >= source.siblings.length) return

    commit((draft) => {
      const location = locateField(draft.fields, id)
      if (!location) return
      const [field] = location.siblings.splice(location.index, 1)
      if (field) location.siblings.splice(target, 0, field)
    })
  }

  /** 同级字段：属性面板的联动条件只能依赖同一作用域里的字段（T19） */
  function siblingsOf(id: string): FieldNode[] {
    return locateField(schema.value.fields, id)?.siblings ?? []
  }

  /** 按 id 取字段：属性面板用它做 diff，无效输入不产生空历史（T19） */
  function fieldById(id: string): FieldNode | undefined {
    return locateField(schema.value.fields, id)?.field
  }

  /**
   * 属性面板写字段（T18）
   *
   * 用 mutator 而不是 patch 对象：一次编辑往往要同时改 label / name / props / rules / layout，
   * 传对象容易出现"没传的键被当成清空"的坑。改动仍然只经过一次 commit。
   */
  function updateField(id: string, mutator: (field: FieldNode) => void): void {
    if (!locateField(schema.value.fields, id)) return

    commit((draft) => {
      const location = locateField(draft.fields, id)
      if (location) mutator(location.field)
    })
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
    if (selectedId.value && !locateField(schema.value.fields, selectedId.value)) {
      selectedId.value = null
    }
  }

  return {
    schema,
    selectedId,
    history,
    selectedField,
    select,
    addField,
    replaceFields,
    replaceChildren,
    removeField,
    duplicateField,
    moveField,
    siblingsOf,
    fieldById,
    updateField,
    commit,
  }
})
