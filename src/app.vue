<script setup lang="ts">
import type { SaveProfile } from '@/storage/profiles'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import AtlasSelect from '@/components/atlas-select.vue'
import ImportDialog from '@/components/import-dialog.vue'
import LanguageToggle from '@/components/language-toggle.vue'
import ProfileManager from '@/components/profile-manager.vue'
import SaveContents from '@/components/save-contents.vue'
import { AppError } from '@/domain/errors'
import { currentLocale, setLocale, tr as t } from '@/modules/i18n'
import { downloadBackup } from '@/storage/backup'
import { listProfiles } from '@/storage/profiles'
import './assets/app.css'
import './assets/slate-theme.css'
import './assets/mobile.css'

const ExplorerPanel = defineAsyncComponent(() => import('@/components/explorer-panel.vue'))
const profiles = shallowRef<SaveProfile[]>([])
const activeId = useLocalStorage('wilds-atlas:active-profile', '')
const current = computed(() => profiles.value.find(p => p.id === activeId.value))
const snapshot = computed(() => current.value?.snapshot)
const options = computed(() => profiles.value.map(p => ({ value: p.id, label: p.name })))
const gameName = computed(() => current.value?.game === 'totk' ? t('game.totk') : current.value?.game === 'botw' ? t('game.botw') : t('game.hyrule-adventure'))
const error = shallowRef<AppError>()
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
  error.value = undefined
  try {
    await downloadBackup()
  }
  catch (e) {
    error.value = AppError.from(e, 'error.operation-failed')
  }
  finally {
    exporting.value = false
  }
}
useHead(() => ({ title: t('app.title'), htmlAttrs: { 'data-game': game.value } }))

const managerOpen = ref(false)
const urlParams = useUrlSearchParams('history')
const compact = useMediaQuery('(max-width: 760px)')
const explorer = ref<InstanceType<typeof ExplorerPanel>>()
const moreOpen = ref(false)
const validTabs = ['atlas', 'checklist', 'progress']
const tab = ref(validTabs.includes(String(urlParams.view)) ? String(urlParams.view) : 'atlas')
watch(compact, (mobile) => {
  if (!mobile && tab.value === 'checklist')
    tab.value = 'atlas'
  moreOpen.value = false
})
watch(tab, (value) => {
  if (value === 'atlas')
    delete urlParams.view
  else urlParams.view = value
})
watch(() => urlParams.view, (value) => {
  tab.value = validTabs.includes(String(value)) ? String(value) : 'atlas'
})
async function reload() {
  profiles.value = await listProfiles()
  if (!current.value)
    activeId.value = profiles.value[0]?.id ?? ''
}
async function openProfile(profileId: string) {
  await reload()
  activeId.value = profileId
  tab.value = 'atlas'
}
onMounted(async () => {
  try {
    await reload()
  }
  catch (e) {
    error.value = AppError.from(e, 'error.profile-load')
  }
  finally {
    busy.value = false
  }
})
</script>

<template>
  <div class="atlas-app" :class="{ 'is-map': tab !== 'progress' }" :data-game="game">
    <a class="skip-link" href="#atlas-main">{{ t('app.skip-to-content') }}</a>
    <TabsRoot v-model="tab" class="app-frame">
      <header class="atlas-header">
        <div class="header-main">
          <AtlasSelect v-if="profiles.length" v-model="activeId" class="header-profile" :label="t('profile.switch')" :options="options" /><AtlasSelect v-else v-model="browseGame" class="header-profile" :label="t('game.select')" :options="[{ value: 'botw', label: t('game.botw') }, { value: 'totk', label: t('game.totk') }]" />
          <TabsList v-if="!compact" class="atlas-navigation" :aria-label="t('profile.contents')">
            <TabsTrigger value="atlas" :aria-label="t('map.title')">
              <span class="i-lucide:map" aria-hidden="true" /><span>{{ t('map.title') }}</span>
            </TabsTrigger>
            <TabsTrigger value="progress" :aria-label="t('progress.tab')">
              <span class="i-lucide:book-open" aria-hidden="true" /><span>{{ t('progress.tab') }}</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <div v-if="!compact" class="header-tools">
          <LanguageToggle class="toolbar-control" />
          <button class="toolbar-control" :aria-label="t('profile.manage')" :title="t('profile.manage')" @click="managerOpen = true">
            <span class="i-lucide:settings-2" aria-hidden="true" />
          </button>
          <button class="toolbar-control" :aria-label="t('profile.export')" :title="t('profile.export')" :disabled="exporting || !profiles.length" @click="download">
            <span class="i-lucide:save" aria-hidden="true" />
          </button>
          <button class="toolbar-control" :aria-label="t('import.open-picker')" :title="t('import.open-picker')" @click="importer?.chooseFile()">
            <span class="i-lucide:upload" aria-hidden="true" />
          </button>
          <button class="toolbar-control" :aria-label="t('import.folder')" :title="t('import.folder')" @click="importer?.chooseFile('folder')">
            <span class="i-lucide:folder-open" aria-hidden="true" />
          </button>
        </div>
        <div v-if="compact" class="mobile-header-actions">
          <button v-if="tab !== 'progress'" class="mobile-filter-button" @click="explorer?.openFilters()">
            <span class="i-lucide:sliders-horizontal" aria-hidden="true" />{{ t('mobile.filters') }}
          </button>
          <button class="icon-button" :aria-label="t('mobile.more')" @click="moreOpen = true">
            <span class="i-lucide:ellipsis" aria-hidden="true" />
          </button>
        </div>
      </header>
      <main id="atlas-main" class="atlas-main" tabindex="-1">
        <p v-if="error" class="error-message app-error" role="alert">
          {{ t(error.key, error.values) }}
        </p>
        <TabsContent v-if="!busy || current" value="atlas" class="map-page" force-mount :hidden="tab === 'progress'">
          <ExplorerPanel ref="explorer" :key="current?.id ?? game" :mobile-page="tab" :active="tab !== 'progress' && !managerOpen && !importOpen && !moreOpen" :profile="current" :game="game" @navigate="tab = $event" @import="importer?.chooseFile()" />
        </TabsContent>
        <div v-if="tab === 'progress' && !busy" class="journal-page">
          <header class="journal-heading">
            <div>
              <span class="eyebrow">{{ gameName }}</span><h1>{{ t('progress.tab') }}</h1><p v-if="current">
                {{ current.name }}<template v-if="snapshot && current.mode !== 'unknown'">
                  · {{ current.mode === 'master' ? t('game.master-mode') : t('game.normal-mode') }}
                </template>
              </p>
            </div><button class="button secondary" @click="tab = 'atlas'">
              <span class="i-lucide:arrow-up-right" aria-hidden="true" />{{ t('map.back') }}
            </button>
          </header>
          <SaveContents v-if="current" :key="current.id" :profile="current" />
          <TabsContent v-else value="progress" class="profile-manager-empty">
            <p>{{ t('profile.empty') }}</p>
            <button class="button primary" @click="managerOpen = true">
              {{ t('profile.manage') }}
            </button>
          </TabsContent>
        </div>
        <div v-if="busy" class="map-loading" role="status">
          {{ t('common.loading') }}
        </div>
      </main>
      <nav v-if="compact" class="mobile-navigation" :aria-label="t('profile.contents')">
        <button :aria-current="tab === 'atlas' ? 'page' : undefined" @click="tab = 'atlas'">
          <span class="i-lucide:map" aria-hidden="true" />{{ t('map.title') }}
        </button>
        <button :aria-current="tab === 'checklist' ? 'page' : undefined" @click="tab = 'checklist'">
          <span class="i-lucide:list-checks" aria-hidden="true" />{{ t('explore.checklist') }}
        </button>
        <button :aria-current="tab === 'progress' ? 'page' : undefined" @click="tab = 'progress'">
          <span class="i-lucide:book-open" aria-hidden="true" />{{ t('progress.tab') }}
        </button>
      </nav>
    </TabsRoot>
    <DialogRoot v-if="compact" v-model:open="moreOpen">
      <DialogPortal>
        <DialogOverlay class="dialog-overlay mobile-sheet-overlay" />
        <DialogContent class="dialog-content mobile-sheet mobile-menu" :aria-describedby="undefined">
          <header class="mobile-sheet-heading">
            <DialogTitle>{{ t('mobile.more') }}</DialogTitle>
            <DialogClose class="icon-button" :aria-label="t('point.close')">
              <span class="i-lucide:x" aria-hidden="true" />
            </DialogClose>
          </header>
          <div class="mobile-menu-actions">
            <button @click="moreOpen = false; managerOpen = true">
              <span class="i-lucide:settings-2" aria-hidden="true" />{{ t('profile.manage') }}
            </button>
            <button :disabled="exporting || !profiles.length" @click="moreOpen = false; download()">
              <span class="i-lucide:save" aria-hidden="true" />{{ t('profile.export') }}
            </button>
            <button @click="moreOpen = false; importer?.chooseFile()">
              <span class="i-lucide:upload" aria-hidden="true" />{{ t('import.open-picker') }}
            </button>
            <button @click="moreOpen = false; importer?.chooseFile('folder')">
              <span class="i-lucide:folder-open" aria-hidden="true" />{{ t('import.folder') }}
            </button>
          </div>
          <label class="mobile-language">
            <span><span class="i-lucide:languages" aria-hidden="true" />{{ t('mobile.language') }}</span>
            <AtlasSelect :model-value="currentLocale" :label="t('mobile.language')" :options="[{ value: 'zh-CN', label: '简体中文' }, { value: 'zh-TW', label: '繁體中文' }, { value: 'ja-JP', label: '日本語' }, { value: 'ko-KR', label: '한국어' }, { value: 'en-US', label: 'English' }]" @update:model-value="setLocale" />
          </label>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
    <ImportDialog ref="importer" v-model:open="importOpen" :profiles="profiles" @selected="managerOpen = false" @imported="openProfile" />
    <ProfileManager
      v-model:open="managerOpen"
      :profiles="profiles"
      :active-id="activeId"
      :game="game"
      @changed="reload"
      @created="openProfile"
      @import="importer?.chooseFile($event)"
      @select="activeId = $event"
    />
  </div>
</template>
