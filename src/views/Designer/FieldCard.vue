<script setup lang="ts">
/**
 * 画布上的字段卡片（T15 渲染 / T17 子表单嵌套拖拽）
 *
 * 自递归：子表单的 children 用同一个组件渲染，嵌套层级的选中 / 操作行为保持一致。
 * 卡片只负责显示与把 id 传回 store，不直接改 schema。
 */
import { computed, ref } from 'vue'
import { useDraggable } from 'vue-draggable-plus'
import { fieldComponent } from '@/components/fields'
import { defaultValueForField } from '@/core/engine/values'
import { getFieldMeta } from '@/core/meta/field-meta'
import type { FieldNode } from '@/core/schema/types'
import { useDesignerStore } from '@/stores/designer'
import { allowsNestedDrop } from './drag'
import { fieldIcon } from './field-icons'

const props = defineProps<{
  field: FieldNode
  index: number
  total: number
}>()

const store = useDesignerStore()

const selected = computed(() => store.selectedId === props.field.id)
const icon = computed(() => fieldIcon(getFieldMeta(props.field.type).icon))
const previewValue = computed(() => defaultValueForField(props.field))
const children = computed(() => props.field.children ?? [])

const childListRef = ref<HTMLElement>()

/** 子表单内的拖拽写回：库回传新数组 → store.replaceChildren（内部 toRaw + commit） */
const childrenModel = computed<FieldNode[]>({
  get: () => props.field.children ?? [],
  set: (next) => store.replaceChildren(props.field.id, next),
})

// 只有子表单需要注册子列表；卡片按 id 复用且类型不可变，条件调用是安全的
if (props.field.type === 'subform') {
  useDraggable<FieldNode>(childListRef, childrenModel, {
    // 与根画布同组：物料可以拖进来，字段也可以在父子之间移动。
    // put 里禁止把父级拖进自己的后代（子表单套自己），否则树会被截断
    group: {
      name: 'fields',
      pull: true,
      put: (to, _from, dragEl) => !dragEl.contains(to.el),
    },
    // 只认直接子卡片，否则嵌套时父列表会把子字段当成自己的排序项
    draggable: '> .card',
    handle: '.card__head',
    filter: '.card__actions',
    forceFallback: true,
    animation: 150,
    onMove: allowsNestedDrop,
    onAdd: (event) => {
      if (event.clonedData?.id) store.select(event.clonedData.id)
    },
  })
}
</script>

<template>
  <article
    class="card"
    :class="{ 'is-selected': selected, 'card--subform': field.type === 'subform' }"
    @click.stop="store.select(field.id)"
  >
    <header class="card__head">
      <component :is="icon" v-if="icon" class="card__icon" />
      <span class="card__label">{{ field.label }}</span>
      <span class="card__type">{{ getFieldMeta(field.type).label }}</span>

      <div class="card__actions" @click.stop>
        <el-button link size="small" :disabled="index === 0" @click="store.moveField(field.id, -1)">
          上移
        </el-button>
        <el-button
          link
          size="small"
          :disabled="index === total - 1"
          @click="store.moveField(field.id, 1)"
        >
          下移
        </el-button>
        <el-button link size="small" @click="store.duplicateField(field.id)">复制</el-button>
        <el-button link size="small" type="danger" @click="store.removeField(field.id)">
          删除
        </el-button>
      </div>
    </header>

    <div class="card__body">
      <div v-if="field.type === 'subform'" class="subform">
        <div ref="childListRef" class="subform__list">
          <FieldCard
            v-for="(child, childIndex) in children"
            :key="child.id"
            :field="child"
            :index="childIndex"
            :total="children.length"
          />
          <p v-if="children.length === 0" class="subform__empty">从物料拖拽字段到这里</p>
        </div>
      </div>

      <el-divider v-else-if="field.type === 'divider'" content-position="left">
        {{ field.label }}
      </el-divider>

      <component
        :is="fieldComponent(field.type)"
        v-else-if="fieldComponent(field.type)"
        :field="field"
        :model-value="previewValue"
        disabled
        class="preview"
      />

      <span v-else class="preview__unsupported">
        暂不支持预览：{{ getFieldMeta(field.type).label }}
      </span>
    </div>
  </article>
</template>

<style scoped>
.card {
  padding: 0 10px 6px;
  border: 1px solid var(--fb-border);
  border-radius: 6px;
  background: var(--fb-bg);
  cursor: pointer;
}

.card:hover {
  border-color: #c7ccd4;
}

.card.is-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgb(64 158 255 / 18%);
}

.card__head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  cursor: grab;
}

.card__icon {
  width: 14px;
  height: 14px;
  color: var(--fb-text-muted);
}

.card__label {
  font-size: 13px;
}

.card__type {
  color: var(--fb-text-muted);
  font-size: 12px;
}

.card__actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.15s;
}

.card:hover .card__actions,
.card.is-selected .card__actions {
  opacity: 1;
}

.card__body {
  padding-bottom: 2px;
}

.preview {
  width: 100%;
}

.preview__unsupported {
  display: block;
  padding: 6px 0;
  color: var(--fb-text-muted);
  font-size: 12px;
}

.subform {
  border-left: 2px dashed var(--fb-border);
}

/* 缩进放进列表自身：整块都是可投放区域，指针不会落在"卡片里但列表外"的死角 */
.subform__list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 44px;
  padding: 4px 0 4px 10px;
}

/* 提示文字不能挡住指针，否则拖拽时命中不到列表 */
.subform__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  color: var(--fb-text-muted);
  font-size: 12px;
  pointer-events: none;
}
</style>
