<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
import { tr as t } from '@/modules/i18n'

defineProps<{ items: { id: string, label: string, icon: string, progress: string }[] }>()
const model = defineModel<string[] | null>({ required: true })
</script>

<template>
  <ToggleGroupRoot type="multiple" class="category-tiles" :aria-label="t('explore.filter-categories')" :model-value="model ?? items.map(item => item.id)" @update:model-value="values => model = Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []">
    <ToggleGroupItem v-for="item in items" :key="item.id" :value="item.id">
      <span class="category-symbol" :class="item.icon" aria-hidden="true" />
      <strong>{{ item.label }}</strong>
      <small v-if="item.progress" class="category-progress"><span class="sr-only">{{ t('status.complete') }} </span>{{ item.progress }}</small>
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>
