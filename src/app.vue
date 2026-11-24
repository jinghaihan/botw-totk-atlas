<script setup lang="ts">
import type { SaveProfile } from '@/storage/profiles'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import AtlasSelect from '@/components/atlas-select.vue'
import ImportDialog from '@/components/import-dialog.vue'
import LanguageToggle from '@/components/language-toggle.vue'
import ProfileManager from '@/components/profile-manager.vue'
import SaveContents from '@/components/save-contents.vue'
import { loadCatalog } from '@/games/catalog'
import { readSave } from '@/games/read-save'
import { tr as t } from '@/modules/i18n'
import { downloadBackup } from '@/storage/backup'
import { listProfiles, saveProfile } from '@/storage/profiles'
import './assets/app.css'
import './assets/slate-theme.css'

const ExplorerPanel = defineAsyncComponent(() => import('@/components/explorer-panel.vue'))
const profiles = shallowRef<SaveProfile[]>([])
const activeId = useLocalStorage('wilds-atlas:active-profile', '')
const current = computed(() => profiles.value.find(p => p.id === activeId.value))
const snapshot = computed(() => current.value?.snapshot)
const options = computed(() => profiles.value.map(p => ({ value: p.id, label: p.name })))
const gameName = computed(() => current.value?.game === 'totk' ? t('王国之泪') : current.value?.game === 'botw' ? t('旷野之息') : t('海拉鲁的冒险'))
const error = ref('')
const busy = ref(true)
const importOpen = ref(false)
const importer = ref<InstanceType<typeof ImportDialog>>()
const browseGame = useLocalStorage('wilds-atlas:browse-game', 'botw')
const game = computed(() => current.value?.game ?? (browseGame.value === 'totk' ? 'totk' : 'botw'))
const exporting = ref(false)
async function download() {
  if (exporting.value)
    return
  exporting.value = true
  error.value = ''
  try {
    await downloadBackup()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('操作未完成，请重试。')
  }
  finally {
    exporting.value = false
  }
}
useHead(() => ({ title: t('塞尔达笔记 · Zelda Notes'), htmlAttrs: { 'data-game': game.value } }))

const managerOpen = ref(false)
const urlParams = useUrlSearchParams('history')
const validTabs = ['atlas', 'progress']
const tab = ref(validTabs.includes(String(urlParams.view)) ? String(urlParams.view) : 'atlas')
watch(tab, (value) => {
  if (value === 'atlas')
    delete urlParams.view
  else urlParams.view = value
})
watch(() => urlParams.view, (value) => {
  tab.value = validTabs.includes(String(value)) ? String(value) : 'atlas'
})
watch([current, tab], ([profile, view]) => {
  if (profile && !profile.snapshot && view === 'progress')
    tab.value = 'atlas'
})
async function reload() {
  profiles.value = await listProfiles()
  if (!current.value)
    activeId.value = profiles.value[0]?.id ?? ''
  if (!current.value)
    tab.value = 'atlas'
}
async function openProfile(profileId: string) {
  await reload()
  activeId.value = profileId
  tab.value = 'atlas'
}
onMounted(async () => {
  try {
    await reload()
    // Local developer fixture is ignored by Git and never copied to production output.
    if (import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'botw-normal') {
      const response = await fetch('/.local/botw-normal.sav', { cache: 'no-store' })
      if (!response.ok)
        throw new Error(t('本地预览存档未找到。'))
      const parsed = await readSave(await response.arrayBuffer(), 'game_data.sav')
      const existing = profiles.value.find(p => p.name === 'BOTW · 普通模式')
      if (existing?.snapshot?.fingerprint === parsed.fingerprint)
        activeId.value = existing.id
      else await openProfile((await saveProfile(parsed, 'BOTW · 普通模式', existing?.id, 'normal', await loadCatalog('botw'))).id)
    }
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('档案加载失败，请检查浏览器存储是否可用。')
  }
  finally {
    busy.value = false
  }
})
</script>

<template>
  <div class="atlas-app" :class="{ 'is-map': tab === 'atlas' }" :data-game="game">
    <a class="skip-link" href="#atlas-main">{{ t('跳至主要内容') }}</a>
    <TabsRoot v-model="tab" class="app-frame">
      <header class="atlas-header">
        <div class="header-main">
          <AtlasSelect v-if="profiles.length" v-model="activeId" class="header-profile" :label="t('切换存档 Profile')" :options="options" /><AtlasSelect v-else v-model="browseGame" class="header-profile" :label="t('选择游戏')" :options="[{ value: 'botw', label: t('旷野之息') }, { value: 'totk', label: t('王国之泪') }]" />
          <TabsList v-if="snapshot" class="atlas-navigation" :aria-label="t('存档内容')">
            <TabsTrigger value="atlas" :aria-label="t('地图')">
              <span class="i-lucide:map" aria-hidden="true" /><span>{{ t('地图') }}</span>
            </TabsTrigger>
            <TabsTrigger value="progress" :aria-label="t('收集')">
              <span class="i-lucide:book-open" aria-hidden="true" /><span>{{ t('收集') }}</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <div class="header-tools">
          <LanguageToggle class="toolbar-control" />
          <button class="toolbar-control" :aria-label="t('管理存档')" :title="t('管理存档')" @click="managerOpen = true">
            <span class="i-lucide:settings-2" aria-hidden="true" />
          </button>
          <button class="toolbar-control" :aria-label="t('导出')" :title="t('导出')" :disabled="exporting || !profiles.length" @click="download">
            <span class="i-lucide:save" aria-hidden="true" />
          </button>
          <button class="toolbar-control" :aria-label="t('导入')" :title="t('导入')" @click="importer?.chooseFile()">
            <span class="i-lucide:upload" aria-hidden="true" />
          </button>
          <button class="toolbar-control" :aria-label="t('导入存档文件夹')" :title="t('导入存档文件夹')" @click="importer?.chooseFile('folder')">
            <span class="i-lucide:folder-open" aria-hidden="true" />
          </button>
        </div>
      </header>
      <main id="atlas-main" class="atlas-main" tabindex="-1">
        <p v-if="error" class="error-message app-error" role="alert">
          {{ t(error) }}
        </p>
        <TabsContent v-if="!busy || current" value="atlas" class="map-page" force-mount :hidden="tab !== 'atlas'">
          <ExplorerPanel :key="current?.id ?? game" :profile="current" :game="game" @import="importer?.chooseFile()" />
        </TabsContent>
        <template v-if="snapshot && current">
          <div v-if="tab !== 'atlas'" class="journal-page">
            <header class="journal-heading">
              <div>
                <span class="eyebrow">{{ gameName }}</span><h1>{{ t('收集') }}</h1><p>
                  {{ current.name }}<template v-if="current.mode !== 'unknown'">
                    · {{ current.mode === 'master' ? t('大师模式') : t('普通模式') }}
                  </template>
                </p>
              </div><button class="button secondary" @click="tab = 'atlas'">
                <span class="i-lucide:arrow-up-right" aria-hidden="true" />{{ t('返回地图') }}
              </button>
            </header>
            <SaveContents :snapshot="snapshot" />
          </div>
        </template>
        <div v-if="busy" class="map-loading" role="status">
          {{ t('正在读取…') }}
        </div>
      </main>
    </TabsRoot>
    <ImportDialog ref="importer" v-model:open="importOpen" :profiles="profiles" @selected="managerOpen = false" @imported="openProfile" />
    <ProfileManager
      v-model:open="managerOpen"
      :profiles="profiles"
      :active-id="activeId"
      :game="game"
      @changed="reload"
      @created="openProfile"
      @restore="importer?.chooseFile('backup')"
      @select="activeId = $event"
    />
  </div>
</template>
