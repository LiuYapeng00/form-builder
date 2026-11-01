/**
 * 嵌套拖拽的投放判定（T17）
 *
 * 父子两个 Sortable 都会认领同一个指针：父列表一旦先把拖拽元素插到自己这边，
 * 之后指针下的元素就变成被拖元素本身，投放目标会被锁死在父列表。
 * 所以指针落在子表单卡片里时，只允许卡片内部的子列表接管。
 */
import type { MoveEvent } from 'vue-draggable-plus'

export function allowsNestedDrop(event: MoveEvent, originalEvent: Event): boolean {
  const point = originalEvent as MouseEvent
  const hit = document.elementFromPoint(point.clientX, point.clientY)

  // 普通卡片照常由所在列表处理；只有子表单卡片需要给内层列表让位
  if (!hit?.closest('.card--subform')) return true

  return hit.closest('.subform__list') === event.to
}
