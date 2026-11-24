<script setup lang="ts">
import { currentLocale, loadLanguageAsync } from '@/modules/i18n'
import AtlasSelect from './atlas-select.vue'
</script>

<template>
  <AtlasSelect class="language-select" :model-value="currentLocale" label="Language / 语言 / 語言 / 言語 / 언어" :options="[{ value: 'zh-CN', label: '简体中文' }, { value: 'zh-TW', label: '繁體中文' }, { value: 'ja-JP', label: '日本語' }, { value: 'ko-KR', label: '한국어' }, { value: 'en-US', label: 'English' }]" @update:model-value="loadLanguageAsync" />
</template>
