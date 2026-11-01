<script setup lang="ts">
/**
 * Schema 导入 / 导出（T21）
 *
 * 导入必须先过 zod（core/schema/zod）：失败时把 fields[3].props.options 这类定位
 * 直接摆给用户，画布保持原样，不接半截数据。
 */
import { computed, ref } from 'vue'
import { DocumentCopy, Download, Upload } from '@element-plus/icons-vue'
import { parseFormSchema } from '@/core/schema/zod'
import type { SchemaIssue } from '@/core/schema/zod'
import { useDesignerStore } from '@/stores/designer'

const store = useDesignerStore()

const importVisible = ref(false)
const importText = ref('')
const issues = ref<SchemaIssue[]>([])
const fileInput = ref<HTMLInputElement>()

const exportJson = computed(() => JSON.stringify(store.schema, null, 2))
/** 错误太多时只展示前 20 条，避免弹窗被撑爆 */
const visibleIssues = computed(() => issues.value.slice(0, 20))

function fileName(): string {
  const base = store.schema.name.trim() || 'form'
  return `${base.replace(/[\\/:*?"<>|]/g, '_')}.json`
}

function download(): void {
  const url = URL.createObjectURL(new Blob([exportJson.value], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName()
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出 JSON')
}

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(exportJson.value)
    ElMessage.success('JSON 已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请检查浏览器剪贴板权限')
  }
}

function openImport(): void {
  importText.value = ''
  issues.value = []
  importVisible.value = true
}

function pickFile(): void {
  fileInput.value?.click()
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // 清空 value 才能再次选择同一个文件
  input.value = ''
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    importText.value = typeof reader.result === 'string' ? reader.result : ''
    issues.value = []
  }
  reader.onerror = () => ElMessage.error('文件读取失败')
  reader.readAsText(file)
}

function confirmImport(): void {
  let parsed: unknown
  try {
    parsed = JSON.parse(importText.value)
  } catch (error) {
    issues.value = [{ path: '(root)', message: `不是合法 JSON：${(error as Error).message}` }]
    return
  }

  const result = parseFormSchema(parsed)
  if (!result.ok) {
    issues.value = result.issues
    return
  }

  store.loadSchema(result.data)
  importVisible.value = false
  ElMessage.success(`已导入「${result.data.name}」`)
}
</script>

<template>
  <div class="schema-io">
    <el-button size="small" :icon="Download" @click="download">导出</el-button>
    <el-button size="small" :icon="DocumentCopy" @click="copy">复制</el-button>
    <el-button size="small" :icon="Upload" @click="openImport">导入</el-button>

    <input
      ref="fileInput"
      class="schema-io__file"
      type="file"
      accept="application/json,.json"
      @change="onFileChange"
    />

    <el-dialog v-model="importVisible" title="导入 JSON" width="640px">
      <div class="schema-io__dialog">
        <el-input
          v-model="importText"
          type="textarea"
          :rows="14"
          placeholder="粘贴 FormSchema JSON，或从文件读取"
        />

        <div v-if="issues.length" class="issues">
          <p class="issues__title">导入失败（{{ issues.length }} 处），修正后再试：</p>
          <ul class="issues__list">
            <li v-for="(issue, index) in visibleIssues" :key="index">
              <code>{{ issue.path }}</code
              >：{{ issue.message }}
            </li>
          </ul>
          <p v-if="issues.length > visibleIssues.length" class="issues__more">
            仅显示前 {{ visibleIssues.length }} 处
          </p>
        </div>
      </div>

      <template #footer>
        <div class="footer">
          <el-button text @click="pickFile">选择文件</el-button>
          <span class="footer__spacer" />
          <el-button @click="importVisible = false">取消</el-button>
          <el-button type="primary" :disabled="!importText.trim()" @click="confirmImport">
            导入
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.schema-io {
  display: flex;
  align-items: center;
  gap: 8px;
}

.schema-io :deep(.el-button + .el-button) {
  margin-left: 0;
}

.schema-io__file {
  display: none;
}

.schema-io__dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.issues {
  padding: 10px 12px;
  border: 1px solid #fbc4c4;
  border-radius: 6px;
  background: #fef0f0;
  font-size: 12px;
}

.issues__title {
  margin: 0 0 6px;
  color: #f56c6c;
  font-weight: 600;
}

.issues__list {
  margin: 0;
  padding-left: 18px;
  max-height: 180px;
  overflow: auto;
  line-height: 1.6;
}

.issues__list code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  color: #c45656;
}

.issues__more {
  margin: 6px 0 0;
  color: var(--fb-text-muted);
}

.footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer :deep(.el-button + .el-button) {
  margin-left: 0;
}

.footer__spacer {
  flex: 1;
}
</style>
