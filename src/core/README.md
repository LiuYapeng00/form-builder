# src/core

**框架无关层。二期换 React 时，这个目录整块搬走。**

## 允许

- 纯 TypeScript、纯函数、纯数据
- 无副作用的工具（path / validate / visibility / io）
- 第三方纯 TS 库：`zod`、`async-validator`、`nanoid`、`lz-string`

## 禁止

- `vue` / `vue-router` / `pinia` / `element-plus` / `vue-draggable-plus`
- 反向依赖 `@/components`、`@/views`、`@/stores`、`@/router`
- 直接访问 `window` / `document` / `localStorage`（存储实现放在调用方或注入进来）

约束通过 `eslint.config.js` 里的 `no-restricted-imports` 强制，`pnpm lint` 会报错。
写代码时如果发现"必须引 vue 才能实现"，说明设计错了——把状态交给调用方，core 只做纯计算。

## 目录

| 目录 | 职责 | 对应任务 |
|---|---|---|
| `schema/types.ts` | 全部类型定义（已完成） | T04 |
| `schema/zod.ts` | 运行时结构校验，导入 JSON 用 | T05 |
| `schema/factory.ts` | createField / createEmptySchema | T05 |
| `schema/migrate.ts` | schemaVersion 迁移链 | 二期再做 |
| `meta/field-meta.ts` | 字段元数据注册表（驱动属性面板） | T07 |
| `engine/path.ts` | 值路径寻址 get/set/deleteByPath | T06 |
| `engine/validate.ts` | Rule[] → async-validator | T10 |
| `engine/visibility.ts` | visibleWhen 求值 + 隐藏字段剔除 | T11 |
| `engine/submit.ts` | SubmitAdapter 接口与 Local 实现 | T12 |
| `io/import.ts` | 导入 JSON + 错误定位 | T21 |
| `io/export.ts` | 导出 JSON | T21 |
| `io/share.ts` | lz-string 链接编解码 + 长度守卫 | T22 |
