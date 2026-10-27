<script setup lang="ts">
import type { FieldNode } from '@/core/schema/types'

defineProps<{ field: FieldNode }>()
const model = defineModel<string | undefined>()
</script>

<template>
  <el-date-picker
    v-model="model"
    type="date"
    value-format="YYYY-MM-DD"
    :placeholder="field.props.placeholder ?? '请选择日期'"
  />
</template>
