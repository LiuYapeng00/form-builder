<script setup lang="ts">
/**
 * upload 字段（T24 降级实现）
 *
 * 一期不接真上传：选完文件只保留文件名数组，文件内容不会离开浏览器。
 * 校验规则收敛在 core/engine/upload.ts，组件只负责触发选择与展示结果。
 */
import { computed, ref } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import { checkUploadFiles } from '@/core/engine/upload'
import type { FieldNode } from '@/core/schema/types'

const props = withDefaults(
  defineProps<{
    field: FieldNode
    disabled?: boolean
  }>(),
  { disabled: false },
)

const model = defineModel<unknown>()

const inputRef = ref<HTMLInputElement>()

const maxCount = computed(() => Math.max(1, props.field.props.maxCount ?? 1))
const maxSizeMB = computed(() => props.field.props.maxSizeMB)
const accept = computed(() => props.field.props.accept?.trim() ?? '')

/** 模型里可能混进脏数据（导入的 JSON 不可信），只认字符串数组 */
const names = computed(() => {
  const value = model.value
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
})

const hint = computed(() => {
  const parts = [accept.value ? `支持 ${accept.value}` : '类型不限']
  parts.push(maxSizeMB.value ? `单个 ≤ ${maxSizeMB.value}MB` : '大小不限')
  parts.push(`最多 ${maxCount.value} 个`)
  return parts.join(' · ')
})

function pick(): void {
  if (props.disabled) return
  inputRef.value?.click()
}

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files ?? [])
  // 清空 value 才能再次选择同一个文件
  input.value = ''
  if (picked.length === 0) return

  const result = checkUploadFiles(
    picked.map((file) => ({ name: file.name, size: file.size, type: file.type })),
    names.value,
    {
      accept: accept.value,
      maxSizeMB: maxSizeMB.value,
      maxCount: maxCount.value,
    },
  )

  if (result.accepted.length > 0) {
    model.value = [...names.value, ...result.accepted]
  }

  if (result.rejected.length > 0) {
    const detail = result.rejected
      .slice(0, 3)
      .map((item) => `${item.name}（${item.reason}）`)
      .join('、')
    const more = result.rejected.length > 3 ? ` 等 ${result.rejected.length} 个文件` : ''
    ElMessage.warning(`已忽略：${detail}${more}`)
  }
}

function removeAt(index: number): void {
  model.value = names.value.filter((_, current) => current !== index)
}
</script>

<template>
  <div class="upload-field">
    <input
      ref="inputRef"
      class="upload-field__input"
      type="file"
      :accept="accept || undefined"
      :multiple="maxCount > 1"
      :disabled="disabled"
      @change="onPick"
    />

    <div class="upload-field__control">
      <el-button :icon="UploadFilled" :disabled="disabled" @click="pick">选择文件</el-button>
      <span class="upload-field__hint">{{ hint }}</span>
    </div>

    <ul v-if="names.length" class="upload-field__list">
      <li v-for="(name, index) in names" :key="`${name}-${index}`" class="upload-field__item">
        <span class="upload-field__name">{{ name }}</span>
        <el-button v-if="!disabled" link type="danger" size="small" @click="removeAt(index)">
          移除
        </el-button>
      </li>
    </ul>

    <p class="upload-field__note">一期只记录文件名，不会上传文件内容。</p>
  </div>
</template>

<style scoped>
.upload-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.upload-field__input {
  display: none;
}

.upload-field__control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.upload-field__hint {
  color: var(--fb-text-muted);
  font-size: 12px;
}

.upload-field__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.upload-field__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  border: 1px solid var(--fb-border);
  border-radius: 4px;
  background: var(--fb-bg-muted);
}

.upload-field__name {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-field__note {
  margin: 0;
  color: var(--fb-text-muted);
  font-size: 12px;
}
</style>
