<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { FormInstance } from 'element-plus'
import RecursiveForm from '@/components/renderer/RecursiveForm.vue'
import { createFormValue } from '@/core/engine/values'
import { buildFormRules } from '@/core/engine/validate'
import { pruneHiddenValues } from '@/core/engine/visibility'
import { leaveSampleSchema as schema } from '@/samples/leave'

const model = reactive(createFormValue(schema.fields))
const formRef = ref<FormInstance>()
const formRules = computed(() => buildFormRules(schema.fields, model))
const submittedJson = ref<string | null>(null)

async function onSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    submittedJson.value = null
    return
  }

  // 隐藏字段不进提交数据；返回新对象，页面上的 model 保持原样
  submittedJson.value = JSON.stringify(pruneHiddenValues(schema.fields, model), null, 2)
  ElMessage.success('校验通过')
}
</script>

<template>
  <main class="page">
    <section class="card">
      <h1>{{ schema.name }}</h1>
      <p class="hint">T10 手测用：必填 / 正则 / 范围错误应红字提示并阻断提交。</p>

      <el-form ref="formRef" :model="model" :rules="formRules" label-position="top" @submit.prevent>
        <RecursiveForm :fields="schema.fields" :model="model" :layout="schema.layout" />

        <div class="actions">
          <el-button type="primary" @click="onSubmit">{{
            schema.submit?.text ?? '提交'
          }}</el-button>
        </div>
      </el-form>
    </section>

    <aside class="snapshot">
      <h2>当前表单值</h2>
      <pre>{{ JSON.stringify(model, null, 2) }}</pre>

      <template v-if="submittedJson">
        <h2>校验通过快照（T12 接提交适配器）</h2>
        <pre>{{ submittedJson }}</pre>
      </template>
    </aside>
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

.snapshot h2 + pre {
  margin-bottom: 20px;
}

.snapshot pre {
  margin: 0 0 16px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
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
