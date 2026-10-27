<script setup lang="ts">
import type { FieldNode } from '@/core/schema/types'

defineProps<{ field: FieldNode }>()
const model = defineModel<string | undefined>({ default: '' })
</script>

<template>
  <el-input v-model="model" :placeholder="field.props.placeholder ?? '请输入'" clearable />
</template>
