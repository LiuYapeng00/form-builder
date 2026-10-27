<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

/** 分享链接格式：/#/f?d=<lz-string 压缩后的 schema>，T22 实现解析 */
const payload = computed(() => (route.query.d as string | undefined) ?? '')
</script>

<template>
  <main class="page">
    <h1>表单填写页（占位）</h1>
    <p class="hint">这一步在 W1 的 T12 打通：静态 JSON → 渲染 → 校验 → 提交。</p>
    <el-alert
      v-if="payload"
      type="info"
      :closable="false"
      title="检测到分享参数 d，解析逻辑见 T22"
    />
    <el-alert v-else type="warning" :closable="false" title="缺少 d 参数：请从设计器生成分享链接" />
  </main>
</template>

<style scoped>
.page {
  padding: 48px;
}
</style>
