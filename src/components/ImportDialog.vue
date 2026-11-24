<script setup lang="ts">
import type { FolderSaveGroup } from '@/games/import-folder'
import type { SaveProfile } from '@/storage/profiles'
import { CheckboxIndicator, CheckboxRoot, DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { loadCatalog } from '@/games/catalog'
import { inspectSaveFolder } from '@/games/import-folder'
import { readSave } from '@/games/read-save'
import { currentLocale, tr as t } from '@/modules/i18n'
import { db, saveProfile } from '@/storage/profiles'
import AtlasSelect from './AtlasSelect.vue'

const props = defineProps<{ profiles: SaveProfile[] }>()
const emit = defineEmits<{ imported: [profile: SaveProfile] }>()
const open = defineModel<boolean>('open', { required: true })
const folderInput = ref<HTMLInputElement>()
const groups = shallowRef<FolderSaveGroup[]>([])
const selected = ref<Record<string, string>>({})
const targets = ref<Record<string, string>>({})
const enabled = ref<Record<string, boolean>>({})
const error = ref('')
const busy = ref(false)
const count = computed(() => groups.value.filter(group => enabled.value[group.id]).length)
const gameLabel = (group: FolderSaveGroup) => group.game === 'botw' ? t('旷野之息') : t('王国之泪')
const modeLabel = (group: FolderSaveGroup) => group.mode === 'master' ? t('大师模式') : group.mode === 'normal' ? t('普通模式') : t('模式未知')
const options = (group: FolderSaveGroup) => [{ value: 'new', label: t('创建新的 Profile') }, ...props.profiles.filter(profile => profile.game === group.game && profile.mode === group.mode).map(profile => ({ value: profile.id, label: t('更新：{name}', { name: profile.name }) }))]
function chooseFile() {
  if (busy.value || !folderInput.value)
    return
  folderInput.value.value = ''
  folderInput.value.click()
}
defineExpose({ chooseFile })
async function choose(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  if (!files.length)
    return
  busy.value = true
  error.value = ''
  groups.value = []
  try {
    const found = await inspectSaveFolder(files)
    if (!found.length)
      throw new Error(t('文件夹里没有找到 game_data.sav 或 progress.sav。'))
    groups.value = found
    selected.value = Object.fromEntries(found.map(group => [group.id, group.candidates[0]!.path]))
    enabled.value = Object.fromEntries(found.map(group => [group.id, true]))
    targets.value = Object.fromEntries(found.map(group => [group.id, 'new']))
    open.value = true
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('无法读取此存档。')
    open.value = true
  }
  finally {
    busy.value = false
  }
}
async function save() {
  busy.value = true
  error.value = ''
  try {
    // Validate every selected save before creating or updating any profile.
    const imports = await Promise.all(groups.value.filter(group => enabled.value[group.id]).map(async (group) => {
      const candidate = group.candidates.find(item => item.path === selected.value[group.id])!
      if (candidate.file.size > 8_000_000)
        throw new Error(t('存档超过支持的大小，请选择单独的 .sav 文件。'))
      const snapshot = await readSave(await candidate.file.arrayBuffer(), candidate.path)
      const catalog = await loadCatalog(snapshot.game)
      const match = props.profiles.find(profile => profile.snapshot.fingerprint === snapshot.fingerprint)
      const target = targets.value[group.id] === 'new' ? match : props.profiles.find(profile => profile.id === targets.value[group.id])
      return { group, snapshot, catalog, target }
    }))
    let last: SaveProfile | undefined
    await db.transaction('rw', db.profiles, db.imports, async () => {
      for (const item of imports) last = await saveProfile(item.snapshot, item.target?.name ?? `${gameLabel(item.group)} · ${modeLabel(item.group)}`, item.target?.id, item.group.mode, item.catalog)
    })
    if (last)
      emit('imported', last)
    open.value = false
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('保存失败，请重试。')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <input ref="folderInput" type="file" webkitdirectory multiple hidden tabindex="-1" aria-hidden="true" @change="choose">
  <span v-if="busy && !open" class="import-reading" role="status">{{ t('正在读取…') }}</span>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" /><DialogContent class="dialog-content folder-import" @interact-outside="busy && $event.preventDefault()" @escape-key-down="busy && $event.preventDefault()">
        <DialogTitle>{{ t('导入存档文件夹') }}</DialogTitle><DialogDescription>{{ t('已找到以下存档，每组默认选择最新。') }}</DialogDescription>
        <form v-if="groups.length" @submit.prevent="save">
          <div v-for="group in groups" :key="group.id" class="folder-save-group">
            <label class="folder-save-heading"><CheckboxRoot :model-value="enabled[group.id]" class="checkbox" :disabled="busy" @update:model-value="enabled[group.id] = $event === true"><CheckboxIndicator>✓</CheckboxIndicator></CheckboxRoot><strong>{{ gameLabel(group) }} · {{ modeLabel(group) }}</strong></label><span class="folder-save-path">{{ selected[group.id] }}</span><small>{{ new Date(group.candidates.find(item => item.path === selected[group.id])!.savedAt).toLocaleString(currentLocale, { hour12: false }) }}</small><details v-if="group.candidates.length > 1">
              <summary>{{ t('选择其他存档') }} · {{ group.candidates.length }}</summary><AtlasSelect v-model="selected[group.id]" :label="t('存档文件')" :options="group.candidates.map(candidate => ({ value: candidate.path, label: candidate.path }))" :disabled="busy" />
            </details><AtlasSelect v-if="options(group).length > 1" v-model="targets[group.id]" :label="t('导入目标')" :options="options(group)" :disabled="busy" />
          </div><p v-if="error" role="alert" class="error-message">
            {{ t(error) }}
          </p><button class="button primary" type="submit" :disabled="busy || count === 0">
            {{ busy ? t('正在处理…') : t('导入 {count} 个存档', { count }) }}
          </button><button class="text-button" type="button" :disabled="busy" @click="chooseFile">
            {{ t('重新选择文件夹') }}
          </button>
        </form>
        <template v-else>
          <p role="alert" class="error-message">
            {{ t(error) }}
          </p><button class="button primary" :disabled="busy" @click="chooseFile">
            {{ t('重新选择文件夹') }}
          </button>
        </template><DialogClose class="dialog-close" :disabled="busy" :aria-label="t('关闭导入窗口')">
          ×
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
