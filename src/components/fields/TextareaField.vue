<script setup lang="ts">
import type { FieldNode } from '@/core/schema/types'

defineProps<{ field: FieldNode }>()
const model = defineModel<string | undefined>({ default: '' })
</script>

<template>
  <el-input
    v-model="model"
    type="textarea"
    :rows="field.props.rows ?? 3"
    :placeholder="field.props.placeholder ?? '请输入'"
  />
</template>
