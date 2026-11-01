<script setup lang="ts">
/**
 * 设计器三栏骨架（T13）
 *
 * 左物料 / 中画布 / 右属性，三块共享同一个 store 的 schema 与选中态。
 * T20 在工具栏加撤销 / 重做，并接管 Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y。
 */
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useDesignerStore } from '@/stores/designer'
import Canvas from './Canvas.vue'
import MaterialPanel from './MaterialPanel.vue'
import PropertyPanel from './PropertyPanel.vue'
import SchemaIO from './SchemaIO.vue'
import ShareLink from './ShareLink.vue'
import TemplatePicker from './TemplatePicker.vue'

const store = useDesignerStore()

const selectionText = computed(() =>
  store.selectedField ? `已选中「${store.selectedField.label}」` : '未选中字段',
)

const canUndo = computed(() => store.history.past.length > 0)
const canRedo = computed(() => store.history.future.length > 0)

/** 输入框里保留浏览器 / 输入法的原生撤销，不要抢 Ctrl+Z */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}

function onKeydown(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || event.isComposing) return
  if (isEditable(event.target)) return

  const key = event.key.toLowerCase()
  if (key === 'z') {
    event.preventDefault()
    if (event.shiftKey) store.redo()
    else store.undo()
    return
  }

  if (key === 'y') {
    event.preventDefault()
    store.redo()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="designer">
    <header class="toolbar">
      <h1 class="toolbar__title">{{ store.schema.name }}</h1>

      <div class="toolbar__actions">
        <span class="toolbar__meta">
          {{ store.schema.fields.length }} 个字段 · {{ selectionText }}
        </span>
        <TemplatePicker />
        <SchemaIO />
        <ShareLink />
        <el-button size="small" :disabled="!canUndo" title="Ctrl+Z" @click="store.undo()">
          撤销
        </el-button>
        <el-button
          size="small"
          :disabled="!canRedo"
          title="Ctrl+Shift+Z / Ctrl+Y"
          @click="store.redo()"
        >
          重做
        </el-button>
      </div>
    </header>

    <div class="workspace">
      <MaterialPanel />
      <Canvas />
      <PropertyPanel :field="store.selectedField ?? null" />
    </div>
  </div>
</template>

<style scoped>
.designer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--fb-border);
}

.toolbar__title {
  margin: 0;
  font-size: 16px;
}

.toolbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar__meta {
  color: var(--fb-text-muted);
  font-size: 12px;
}

.workspace {
  display: grid;
  flex: 1;
  grid-template-columns: 240px minmax(0, 1fr) 300px;
  min-height: 0;
}
</style>
