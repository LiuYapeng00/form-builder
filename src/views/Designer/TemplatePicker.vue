<script setup lang="ts">
/**
 * 模板下拉（T25）
 *
 * 一键加载内置示例，加载走 store.loadSchema（可撤销、清空选中），
 * 所以误点模板不会把用户刚搭的表单永久覆盖。
 */
import { FORM_TEMPLATES, findTemplate } from '@/samples'
import { useDesignerStore } from '@/stores/designer'

const store = useDesignerStore()

function load(id: string | number): void {
  const template = findTemplate(String(id))
  if (!template) return

  store.loadSchema(template.schema)
  ElMessage.success(`已加载「${template.name}」模板，可用撤销恢复`)
}
</script>

<template>
  <el-dropdown trigger="click" @command="load">
    <el-button size="small">模板</el-button>

    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="template in FORM_TEMPLATES"
          :key="template.id"
          :command="template.id"
        >
          <span class="template">
            <span class="template__name">{{ template.name }}</span>
            <span class="template__desc">{{ template.description }}</span>
          </span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.template {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 260px;
  padding: 2px 0;
}

.template__name {
  font-size: 13px;
  font-weight: 600;
}

.template__desc {
  color: var(--fb-text-muted);
  font-size: 12px;
  line-height: 1.4;
}
</style>
