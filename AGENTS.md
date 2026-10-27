# AGENTS.md · Form Builder 一期

> 给 AI 编码助手（以及未来的自己）看的项目约定。**与本文冲突的默认行为一律以本文为准。**

## 1. 这是个什么东西

Vue3 + TS 的可视化表单设计器。一期目标只有一个：
**有一个真实链接，能拖出表单 → 导出 JSON → 换链接打开能填 → 提交有反馈。**

- 设计真源：`docs/一期-技术方案.md`（Schema 结构、模块划分、决策理由都在这里）
- 任务真源：`docs/一期-任务清单.md`（按 T 编号顺序执行，勾选即进度）
- 一期**不做**：审批流编排、Schema 版本化/回滚、用户体系、权限、多租户、数据统计、模板市场

## 2. 硬边界（违反即视为 bug）

1. **`src/core/**` 禁止 import `vue` / `pinia` / `vue-router` / `element-plus` / `vue-draggable-plus`**，也禁止反向依赖 `@/components`、`@/views`、`@/stores`、`@/router`。`pnpm lint` 已强制。
2. 禁止在 `src/core` 里直接使用 `window` / `document` / `localStorage`；存储能力由调用方注入。
3. 禁止修改 Schema 结构（`src/core/schema/types.ts`）而不更新 `docs/一期-技术方案.md` §2.2。
4. 禁止引入新依赖（包体积影响首屏）。确有必要先说明理由并等确认。
5. 禁止顺手重构、批量改格式、跨任务"优化"。一次只做一个 T 编号。

## 3. 常用命令

| 命令 | 用途 |
|---|---|
| `pnpm dev` | 本地开发，http://localhost:5173 |
| `pnpm typecheck` | `vue-tsc --noEmit` |
| `pnpm lint` | ESLint（含 core 边界检查） |
| `pnpm test` | Vitest（只测 `tests/**`，主要覆盖 core） |
| `pnpm build` | typecheck + 产物构建到 `dist/` |
| **`pnpm verify`** | typecheck + lint + test + build，**每个任务收尾必须全绿** |

## 4. 代码约定

- 一律 `<script setup lang="ts">`，Vue 组合式 API，不写 Options API
- 组件文件 PascalCase（`FieldRenderer.vue`），组合函数 `useXxx.ts`
- **显式 import** `ref` / `computed` / `defineStore` 等；只有 `el-*` 组件和 `ElMessage` 走自动引入
- 类型优先：禁止 `any`，不确定用 `unknown` + 类型守卫
- `verbatimModuleSyntax` 已开启：只导入类型时必须写 `import type`
- 注释写"为什么"，不写"是什么"；中文注释
- 样式：`<style scoped>` + CSS 变量（见 `src/styles/main.css`），不引 UI 框架之外的样式库

## 5. 执行流程（每个任务）

1. 读 `docs/一期-任务清单.md`，取**编号最小的未勾选任务**
2. 读 `docs/一期-技术方案.md` 中相关章节，先说 3 行实现计划
3. 实现（只碰该任务相关文件）
4. `pnpm verify` 全绿
5. 勾选任务清单里的 checkbox，并在该任务行末补 `— ✅ 简述`（若与设计有偏差，同步更新技术方案）
6. 提交：`feat(designer): T14 add field by clicking material`（英文，见 §7）

标记 🔒 的任务（T06 / T12 / T16 / T20 / T28）涉及已知难点，先讲思路再落代码。

## 6. 已知坑（别重复踩）

| 坑 | 正确做法 |
|---|---|
| 拖拽 clone 后多个字段联动 | 物料 `clone` 必须深拷贝 + 生成新 `nanoid`，禁止共享引用 |
| 属性面板输入疯狂产生历史记录 | `commit()` 前 debounce 300ms 或用 `@change` 提交 |
| 嵌套 subform 拖拽错位 | Sortable 嵌套已知问题；不稳定就降级为"选中后在属性面板加子字段" |
| GitHub Pages 资源 404 | `base` 走 `VITE_BASE`，本地不要硬编码子路径 |
| 刷新 404 | 只能 hash 路由，禁止 `createWebHistory` |
| 校验规则写成函数 | 规则必须是可序列化数据（`Rule[]`），否则导入导出断裂 |
| 表单值平铺丢失层级 | 统一用 `getByPath` / `setByPath` 寻址，禁止手工拼字符串 |

## 7. 提交规范

Conventional Commits，scope 用目录名，**提交信息一律用英文**：

```
feat(core): T05 add zod validation and field factory
fix(designer): T16 prevent shared reference after drag clone
docs: update design doc section 2.6 fallback plan
chore: bump dependencies
```

> ⚠️ Windows 编码坑（本机已实测）：这台机器的 git 运行在 cp936 locale 下，
> 中文字符写入 commit 会全部变成 `?`（message 和 author 都会被破坏）。
> `i18n.commitEncoding=UTF-8` 也救不回来。所以：
> - 提交信息只用 ASCII
> - `git config user.name` 已设为 ASCII 英文名，**不要改回中文**，否则 author 会变 `?????`
> - 需要中文说明时，用 `-m` 之外的正文写进 PR/文档，不要塞进 commit message

每完成一个 S 阶段（S0/S1/S2/S3）再 push，不要每个任务都推。
