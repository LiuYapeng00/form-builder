<script setup lang="ts">
import type { FieldNode } from '@/core/schema/types'

defineProps<{ field: FieldNode }>()
const model = defineModel<number | undefined>()
</script>

<template>
  <el-input-number
    v-model="model"
    :min="field.props.min"
    :max="field.props.max"
    :step="field.props.step ?? 1"
    :placeholder="field.props.placeholder"
    controls-position="right"
  />
</template>
