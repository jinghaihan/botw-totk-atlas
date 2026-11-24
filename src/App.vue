<script setup lang="ts">
import type { SaveProfile } from '@/storage/profiles'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import AtlasSelect from '@/components/AtlasSelect.vue'
import ImportDialog from '@/components/ImportDialog.vue'
import ImportHistory from '@/components/ImportHistory.vue'
import LanguageToggle from '@/components/language-toggle.vue'
import ProfileManager from '@/components/ProfileManager.vue'
import SaveContents from '@/components/SaveContents.vue'
import { loadCatalog } from '@/games/catalog'
import { readSave } from '@/games/read-save'
import { currentLocale, tr as t } from '@/modules/i18n'
import { listProfiles, saveProfile } from '@/storage/profiles'
import './assets/atlas.css'
import './assets/slate-theme.css'

const ExplorerPanel = defineAsyncComponent(() => import('@/components/ExplorerPanel.vue'))
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
function chooseSave() {
  importer.value?.chooseFile()
}
useHead(() => ({ title: t('旷野图志 · Wilds Atlas'), htmlAttrs: { 'data-game': game.value } }))

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
const time = (s: string) => new Date(s).toLocaleString(currentLocale.value, { hour12: false })
async function reload() {
  profiles.value = await listProfiles()
  if (!current.value)
    activeId.value = profiles.value[0]?.id ?? ''
  if (!current.value)
    tab.value = 'atlas'
}
async function imported(p: SaveProfile) {
  await reload()
  activeId.value = p.id
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
      if (existing?.snapshot.fingerprint === parsed.fingerprint)
        activeId.value = existing.id
      else await imported(await saveProfile(parsed, 'BOTW · 普通模式', existing?.id, 'normal', await loadCatalog('botw')))
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
        <div class="header-identity">
          <button class="atlas-brand" :aria-label="t('返回地图')" @click="tab = 'atlas'">
            <svg viewBox="0 0 40 44" aria-hidden="true"><path d="M20 2 38 34H2Z M20 16 29 32H11Z M11 18 20 34 29 18" /></svg>
            <span translate="no">WILDS ATLAS<small>{{ t('旷野图志') }}</small></span>
          </button>
          <span class="identity-divider" />
          <AtlasSelect v-if="profiles.length" v-model="activeId" class="header-profile" :label="t('切换存档 Profile')" :options="options" /><AtlasSelect v-else v-model="browseGame" class="header-profile" :label="t('选择游戏')" :options="[{ value: 'botw', label: t('旷野之息') }, { value: 'totk', label: t('王国之泪') }]" />
        </div>
        <TabsList v-if="current" class="atlas-navigation" :aria-label="t('存档内容')">
          <TabsTrigger value="atlas">
            <span class="i-lucide:map" aria-hidden="true" /><span>{{ t('地图') }}</span>
          </TabsTrigger>
          <TabsTrigger value="progress">
            <span class="i-lucide:book-open" aria-hidden="true" /><span>{{ t('收集') }}</span>
          </TabsTrigger>
        </TabsList>
        <div class="header-tools">
          <LanguageToggle />
          <button class="icon-button" :aria-label="t('管理与备份')" @click="managerOpen = true">
            <span class="i-lucide:settings-2" aria-hidden="true" />
          </button>
          <button class="button primary import-action" @click="chooseSave">
            <span class="i-lucide:upload" aria-hidden="true" /><span>{{ t('导入存档') }}</span>
          </button>
        </div>
      </header>
      <main id="atlas-main" class="atlas-main" tabindex="-1">
        <p v-if="error" class="error-message app-error" role="alert">
          {{ t(error) }}
        </p>
        <TabsContent v-if="!busy || current" value="atlas" class="map-page" force-mount :hidden="tab !== 'atlas'">
          <ExplorerPanel :key="current?.id ?? game" :profile="current" :game="game" @import="chooseSave" />
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
            <TabsContent value="progress">
              <details class="save-provenance">
                <summary>{{ t('存档与导入记录') }}</summary><p>{{ snapshot.filename }} · {{ time(snapshot.importedAt) }}</p><code>{{ snapshot.fingerprint }}</code><ImportHistory :profile="current" />
              </details>
            </TabsContent>
          </div>
        </template>
        <div v-if="busy" class="map-loading" role="status">
          {{ t('正在读取…') }}
        </div>
      </main>
    </TabsRoot>
    <ImportDialog ref="importer" v-model:open="importOpen" :profiles="profiles" @imported="imported" />
    <ProfileManager v-model:open="managerOpen" :profiles="profiles" @changed="reload" @restored="activeId = $event" />
  </div>
</template>
