<script setup lang="ts">
import { ref } from 'vue'

const bootedAt = ref(new Date().toLocaleTimeString('zh-CN'))
const base = import.meta.env.BASE_URL
</script>

<template>
  <main class="page">
    <h1>Form Builder · 一期</h1>
    <p class="hint">脚手架已就绪（T01–T04）。设计器三栏界面在 T13 开始实现。</p>

    <el-space direction="vertical" :size="10" alignment="start">
      <el-tag type="success">Element Plus 按需加载正常</el-tag>
      <span class="mono">base = {{ base }}</span>
      <span class="mono">启动于 {{ bootedAt }}</span>
      <el-button type="primary" @click="bootedAt = new Date().toLocaleTimeString('zh-CN')">
        刷新时间
      </el-button>
    </el-space>
  </main>
</template>

<style scoped>
.page {
  padding: 48px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 13px;
  color: #666;
}
</style>
