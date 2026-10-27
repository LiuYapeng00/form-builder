---
description: 阶段收尾：全量验证 + 部署前检查 + 进度同步
---

阶段收尾（每完成 S0 / S1 / S2 / S3 时跑一次）。不要自行 `git push`。

1. `pnpm verify` 全绿。
2. `pnpm build` 后检查产物：
   - `dist/index.html` 里的资源路径是否带正确的 base 前缀
   - 构建体积（记进 README 的"实测数据"）
3. `pnpm preview` 打开页面，确认 hash 路由能跳转、Element Plus 组件样式正常。
4. 对照 `docs/一期-任务清单.md`：
   - 本阶段任务是否全部勾选
   - 未完成的写明原因，并决定是补做还是移到下阶段
5. 更新 `README.md` 的"当前进度"表格。
6. 输出建议的 commit message（Conventional Commits，中文描述）。

最后列出：本阶段实际耗时 / 卡住的点 / 下一步风险。$ARGUMENTS
