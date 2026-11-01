<script setup lang="ts">
/**
 * 分享链接（T22）
 *
 * 生成 /#/f?d=<lz-string> 的完整地址；编码后超过 6000 字符时明确报错，
 * 引导用户改用 JSON 导入，不生成一条注定打不开的链接。
 */
import { ref } from 'vue'
import { Share } from '@element-plus/icons-vue'
import type { InputInstance } from 'element-plus'
import { SHARE_URL_LIMIT, buildShareUrl, encodeShare } from '@/core/share'
import { useDesignerStore } from '@/stores/designer'

const store = useDesignerStore()

const visible = ref(false)
const link = ref('')
const error = ref('')
const linkInput = ref<InputInstance>()

function open(): void {
  const result = encodeShare(store.schema)
  if (!result.ok) {
    error.value = `表单过大：编码后 ${result.length} 字符，超过 ${SHARE_URL_LIMIT} 上限。请改用「导出 JSON」后发给对方导入。`
    link.value = ''
  } else {
    error.value = ''
    link.value = buildShareUrl(window.location.href, result.data)
  }
  visible.value = true
}

async function copyLink(): Promise<void> {
  if (!link.value) return
  try {
    await navigator.clipboard.writeText(link.value)
    ElMessage.success('分享链接已复制')
  } catch {
    // 剪贴板被拒时把文本选中，用户可以直接 Ctrl+C
    linkInput.value?.select()
    ElMessage.error('复制失败，请手动复制已选中的链接')
  }
}
</script>

<template>
  <div class="share">
    <el-button size="small" :icon="Share" @click="open">分享</el-button>

    <el-dialog v-model="visible" title="分享链接" width="620px">
      <el-alert v-if="error" type="warning" :closable="false" show-icon :title="error" />

      <template v-else>
        <p class="share__hint">
          链接里压缩了整份表单（{{ link.length }} 字符），打开即可填写，不需要后端。
        </p>
        <el-input ref="linkInput" :model-value="link" readonly class="share__link" />
      </template>

      <template #footer>
        <div class="footer">
          <el-button @click="visible = false">关闭</el-button>
          <el-button v-if="link" type="primary" @click="copyLink">复制链接</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.share__hint {
  margin: 0 0 8px;
  color: var(--fb-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.share__link :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.footer :deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
