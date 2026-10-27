<script setup lang="ts">
import type { FieldNode } from '@/core/schema/types'

defineProps<{ field: FieldNode }>()
const model = defineModel<boolean>({ default: false })
</script>

<template>
  <el-switch v-model="model" />
</template>
