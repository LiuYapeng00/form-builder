import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// GitHub Pages 部署在 https://<user>.github.io/<repo>/ 子路径下，
// 必须通过 VITE_BASE 注入 '/<repo>/'，否则资源全部 404。
// 本地开发、Cloudflare Pages、OSS 等根路径部署保持默认 '/'。
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    vue(),
    // 只自动引入 Element Plus 的 ElMessage/ElLoading 等函数式 API。
    // ref/computed/defineStore 等请显式 import，避免依赖隐式全局。
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: 'src/types/auto-imports.d.ts',
    }),
    // el-button 等组件按需引入，避免整包进入 bundle（构建体积影响首屏）。
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/types/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
})
