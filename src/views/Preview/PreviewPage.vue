<script setup lang="ts">
import { reactive } from 'vue'
import RecursiveForm from '@/components/renderer/RecursiveForm.vue'
import { createFormValue } from '@/core/engine/values'
import { leaveSampleSchema as schema } from '@/samples/leave'

const model = reactive(createFormValue(schema.fields))
</script>

<template>
  <main class="page">
    <section class="card">
      <h1>{{ schema.name }}</h1>
      <p class="hint">T09 手测用：改任意控件，右侧/下方 JSON 应实时变化；子表单可增删行。</p>

      <el-form :model="model" label-position="top">
        <RecursiveForm :fields="schema.fields" :model="model" :layout="schema.layout" />
      </el-form>
    </section>

    <aside class="snapshot">
      <h2>当前表单值</h2>
      <pre>{{ JSON.stringify(model, null, 2) }}</pre>
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
