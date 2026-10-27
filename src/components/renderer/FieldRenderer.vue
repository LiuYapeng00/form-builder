<script setup lang="ts">
/**
 * 字段渲染器（T08）
 *
 * 设计态与运行态共用一套组件，只有三处差别：
 * 1. designMode 时控件禁用（遮罩挡住，避免误输入）
 * 2. 点击冒泡出 select 事件，交给画布做选中
 * 3. 不参与校验拦截（设计态不该弹红字）
 *
 * 子表单不进这里：它需要递归渲染子字段，由 RecursiveForm 负责（T09）。
 */
import { computed } from 'vue'
import type { FieldNode } from '@/core/schema/types'
import { fieldComponent } from '@/components/fields'

const props = withDefaults(
  defineProps<{
    field: FieldNode
    /** el-form-item 的 prop 路径，子表单内是 employees.0.name 这种形式 */
    path?: string
    designMode?: boolean
  }>(),
  { path: '', designMode: false },
)

const emit = defineEmits<{
  select: [field: FieldNode]
}>()

const model = defineModel<unknown>()

const component = computed(() => fieldComponent(props.field.type))
</script>

<template>
  <el-divider v-if="field.type === 'divider'" content-position="left">
    {{ field.label }}
  </el-divider>

  <el-form-item v-else :label="field.label" :prop="path || undefined">
    <div class="field-body" :class="{ 'is-design': designMode }">
      <component
        :is="component"
        v-if="component"
        v-model="model"
        :field="field"
        :disabled="designMode"
        class="field-control"
      />
      <span v-else class="field-unsupported">暂不支持的字段类型：{{ field.type }}</span>

      <!-- 透明遮罩：设计态拦截所有交互，点击只做选中，绝不改值 -->
      <div v-if="designMode" class="design-mask" @click.stop="emit('select', field)" />
    </div>
  </el-form-item>
</template>

<style scoped>
.field-body {
  position: relative;
  width: 100%;
}

.field-control {
  width: 100%;
}

.field-unsupported {
  color: var(--fb-text-muted);
  font-size: 13px;
}

.design-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  cursor: pointer;
}
</style>
