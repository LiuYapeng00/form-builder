<script setup lang="ts">
/**
 * 表单填写页 / 一期 W1 里程碑（T12）
 *
 * 数据流：静态 JSON → RecursiveForm 渲染 → el-form 校验 → 剔除隐藏值 → SubmitAdapter → localStorage + JSON 快照。
 * 分享链接解析在 T22 接入，这里先用内置样例 Schema。
 */
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { FormInstance } from 'element-plus'
import RecursiveForm from '@/components/renderer/RecursiveForm.vue'
import { SUBMISSIONS_KEY, createLocalSubmitAdapter } from '@/core/engine/submit'
import { createFormValue } from '@/core/engine/values'
import { buildFormRules } from '@/core/engine/validate'
import { pruneHiddenValues } from '@/core/engine/visibility'
import { decodeShare } from '@/core/share'
import type { SubmitPayload } from '@/core/schema/types'
import { leaveSampleSchema } from '@/samples/leave'

const route = useRoute()
// 无 d 参数时保留内置样例（T12 里程碑入口）；坏链接只报错，不渲染半截数据
const decoded = decodeShare(typeof route.query.d === 'string' ? route.query.d : undefined)
const schema = decoded.ok ? decoded.data : leaveSampleSchema

const linkError =
  decoded.ok || decoded.reason === 'empty'
    ? ''
    : decoded.reason === 'corrupt'
      ? '链接数据损坏，无法解析。请让分享者重新生成链接。'
      : '链接里的表单结构不合法，无法渲染。'
const linkIssues = decoded.ok || decoded.reason !== 'invalid' ? [] : decoded.issues.slice(0, 10)

const model = reactive(createFormValue(schema.fields))
const formRef = ref<FormInstance>()
const formRules = computed(() => buildFormRules(schema.fields, model))
const submitted = ref<SubmitPayload | null>(null)
const submitting = ref(false)

// 存储能力注入给 core：core 自己不碰 window / localStorage
const submitAdapter = createLocalSubmitAdapter(window.localStorage)
const successMsg = computed(() => schema.submit?.successMsg ?? '提交成功')

async function onSubmit(): Promise<void> {
  if (submitting.value) return

  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    submitted.value = null
    return
  }

  submitting.value = true
  try {
    const payload: SubmitPayload = {
      schemaId: schema.id,
      schemaVersion: schema.schemaVersion,
      // 隐藏字段不进提交数据；返回新对象，页面上的 model 保持原样
      data: pruneHiddenValues(schema.fields, model),
      submittedAt: new Date().toISOString(),
    }
    const result = await submitAdapter.submit(payload)

    if (!result.ok) {
      ElMessage.error(result.error)
      return
    }

    submitted.value = payload
    ElMessage.success(successMsg.value)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="page">
    <section v-if="linkError" class="card card--error">
      <h1>链接无效</h1>
      <p class="hint">{{ linkError }}</p>
      <ul v-if="linkIssues.length" class="issues">
        <li v-for="(issue, index) in linkIssues" :key="index">
          <code>{{ issue.path }}</code
          >：{{ issue.message }}
        </li>
      </ul>
      <p class="back">
        <router-link to="/">回到设计器</router-link>
      </p>
    </section>

    <template v-else>
      <section class="card">
        <h1>{{ schema.name }}</h1>
        <p class="hint">表单数据只写入本机 localStorage，不会上传到任何服务器。</p>

        <el-alert
          v-if="submitted"
          class="success"
          type="success"
          :closable="false"
          show-icon
          :title="successMsg"
        >
          <p class="success__line">
            提交时间：{{ new Date(submitted.submittedAt).toLocaleString('zh-CN') }}
          </p>
          <p class="success__line">已写入 localStorage 键：{{ SUBMISSIONS_KEY }}</p>
        </el-alert>

        <el-form
          ref="formRef"
          :model="model"
          :rules="formRules"
          label-position="top"
          @submit.prevent
        >
          <RecursiveForm :fields="schema.fields" :model="model" :layout="schema.layout" />

          <div class="actions">
            <el-button type="primary" :loading="submitting" @click="onSubmit">
              {{ schema.submit?.text ?? '提交' }}
            </el-button>
          </div>
        </el-form>
      </section>

      <aside class="snapshot">
        <h2>提交快照（SubmitPayload）</h2>
        <pre v-if="submitted">{{ JSON.stringify(submitted, null, 2) }}</pre>
        <p v-else class="snapshot__empty">提交成功后会在这里展示实际写入的数据。</p>
      </aside>
    </template>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 24px;
  max-width: 1200px;
  padding: 32px 24px 64px;
  margin: 0 auto;
}

.card {
  padding: 24px;
  border: 1px solid var(--fb-border);
  border-radius: 10px;
}

.card--error {
  grid-column: 1 / -1;
  border-color: #fbc4c4;
}

.issues {
  margin: 12px 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
}

.issues code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  color: #c45656;
}

.back {
  margin: 16px 0 0;
  font-size: 13px;
}

.success {
  margin-bottom: 20px;
}

.success__line {
  margin: 4px 0 0;
  font-size: 13px;
}

.actions {
  padding-top: 8px;
}

.snapshot {
  position: sticky;
  top: 24px;
  align-self: start;
  padding: 16px;
  overflow: auto;
  max-height: calc(100vh - 48px);
  border: 1px solid var(--fb-border);
  border-radius: 10px;
  background: var(--fb-bg-muted);
}

.snapshot h2 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}

.snapshot pre {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.snapshot__empty {
  margin: 0;
  color: var(--fb-text-muted);
  font-size: 13px;
}

@media (max-width: 900px) {
  .page {
    grid-template-columns: 1fr;
    padding: 16px;
  }

  .snapshot {
    position: static;
    max-height: none;
  }
}
</style>
