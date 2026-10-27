<script setup lang="ts">
import type { FieldNode } from '@/core/schema/types'

defineProps<{ field: FieldNode }>()
const model = defineModel<string | string[] | undefined>()
</script>

<template>
  <el-select
    v-model="model"
    :multiple="field.props.multiple"
    :placeholder="field.props.placeholder ?? '请选择'"
    clearable
  >
    <el-option
      v-for="option in field.props.options ?? []"
      :key="option.value"
      :label="option.label"
      :value="option.value"
    />
  </el-select>
</template>
