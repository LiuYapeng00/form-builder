import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      // 这两个文件由 unplugin 生成，不参与手写维护
      'src/types/auto-imports.d.ts',
      'src/types/components.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        // 由 unplugin-auto-import 注入（Element Plus 函数式 API）
        ElMessage: 'readonly',
        ElMessageBox: 'readonly',
        ElLoading: 'readonly',
        ElNotification: 'readonly',
      },
    },
  },
  /**
   * 硬边界：src/core 必须与框架无关。
   * 这是二期换 Next.js/React 重写时能直接复用 core 的前提，
   * 也是"同一 Schema 引擎两种实现"的物理保障。
   */
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'vue',
                'vue-router',
                'pinia',
                'element-plus',
                'element-plus/*',
                '@element-plus/*',
                'vue-draggable-plus',
              ],
              message: 'src/core 必须与框架无关：这里只允许纯 TS。UI 相关逻辑请放到 src/components 或 src/views。',
            },
            {
              group: ['@/components/*', '@/views/*', '@/stores/*', '@/router/*'],
              message: 'src/core 不得反向依赖 UI 层。',
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
)
