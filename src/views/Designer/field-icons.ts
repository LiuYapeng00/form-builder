/**
 * 字段图标映射（T14）
 *
 * core 的 field-meta 只存图标名（core 不能 import element-plus），
 * 真实组件在这里按名字映射 —— 加字段类型时 core 不动，UI 这里补一行。
 */
import {
  ArrowDown,
  Calendar,
  CircleCheck,
  Document,
  EditPen,
  Files,
  Finished,
  Minus,
  Odometer,
  SwitchButton,
  UploadFilled,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'

const ICONS: Record<string, Component> = {
  ArrowDown,
  Calendar,
  CircleCheck,
  Document,
  EditPen,
  Files,
  Finished,
  Minus,
  Odometer,
  SwitchButton,
  UploadFilled,
}

/** 查不到时返回 undefined，调用方降级成纯文字，不阻塞渲染 */
export function fieldIcon(name: string): Component | undefined {
  return ICONS[name]
}
