<script setup lang="ts">
import { currentLocale, loadLanguageAsync } from '@/modules/i18n'
import AtlasSelect from './atlas-select.vue'
</script>

<template>
  <AtlasSelect class="language-select" :model-value="currentLocale" label="Language / 语言 / 語言" :options="[{ value: 'zh-CN', label: '简体中文' }, { value: 'zh-TW', label: '繁體中文' }, { value: 'en-US', label: 'English' }]" @update:model-value="loadLanguageAsync" />
</template>
