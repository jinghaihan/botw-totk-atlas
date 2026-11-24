<script setup lang="ts">
import { SelectContent, SelectItem, SelectItemIndicator, SelectItemText, SelectPortal, SelectRoot, SelectTrigger, SelectValue, SelectViewport } from 'reka-ui'

defineOptions({ inheritAttrs: false })
defineProps<{ label: string, options: { value: string, label: string }[], disabled?: boolean }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <SelectRoot v-model="model" :disabled="disabled">
    <SelectTrigger v-bind="$attrs" class="filter-trigger" :aria-label="label">
      <slot name="trigger">
        <SelectValue :placeholder="label" /><span class="i-lucide:chevrons-up-down" />
      </slot>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="select-menu" position="popper" :side-offset="6">
        <SelectViewport>
          <SelectItem v-for="o in options" :key="o.value" :value="o.value" class="select-item">
            <SelectItemText>{{ o.label }}</SelectItemText><SelectItemIndicator>✓</SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
