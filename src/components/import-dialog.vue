<script setup lang="ts">
import type { GameSnapshot } from '@/domain/game'
import type { FolderSaveGroup } from '@/games/import-folder'
import type { SaveProfile } from '@/storage/profiles'
import { CheckboxIndicator, CheckboxRoot, DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { loadCatalog } from '@/games/catalog'
import { inspectSaveFolder } from '@/games/import-folder'
import { readSave } from '@/games/read-save'
import { currentLocale, tr as t } from '@/modules/i18n'
import { backupSchema, restoreBackup } from '@/storage/backup'
import { db, saveProfile } from '@/storage/profiles'
import AtlasSelect from './atlas-select.vue'

type ImportSource = 'file' | 'folder' | 'backup'
const props = defineProps<{ profiles: SaveProfile[] }>()
const emit = defineEmits<{ selected: [], imported: [profileId: string] }>()
const open = defineModel<boolean>('open', { required: true })
const fileInput = ref<HTMLInputElement>()
const folderInput = ref<HTMLInputElement>()
const source = ref<ImportSource>('file')
const filename = ref('')
const backup = shallowRef<ReturnType<typeof backupSchema.parse>>()
const singleSave = shallowRef<GameSnapshot>()
const groups = shallowRef<FolderSaveGroup[]>([])
const selected = ref<Record<string, string>>({})
const targets = ref<Record<string, string>>({})
const enabled = ref<Record<string, boolean>>({})
const error = ref('')
const busy = ref(false)
const count = computed(() => groups.value.filter(group => enabled.value[group.id]).length)
const gameLabel = (group: FolderSaveGroup) => group.game === 'botw' ? t('旷野之息') : t('王国之泪')
const modeLabel = (group: FolderSaveGroup) => group.mode === 'master' ? t('大师模式') : t('普通模式')
const title = computed(() => backup.value || source.value === 'backup' ? t('恢复备份') : source.value === 'folder' ? t('导入存档文件夹') : t('导入存档'))
function options(group: FolderSaveGroup) {
  const compatible = props.profiles.filter(profile => profile.game === group.game && (group.mode === 'unknown' || profile.mode === group.mode || (!profile.snapshot && profile.mode === 'unknown')))
  return [{ value: 'new', label: t('创建新的 Profile') }, ...compatible.map(profile => ({ value: profile.id, label: t('更新：{name}', { name: profile.name }) }))]
}
function chooseFile(from: ImportSource = 'file') {
  const input = from === 'folder' ? folderInput.value : fileInput.value
  if (!input || busy.value)
    return
  source.value = from
  if (from !== 'folder')
    input.accept = from === 'backup' ? '.json,application/json' : '.sav,.json,application/json'
  input.value = ''
  input.click()
}
defineExpose({ chooseFile })

async function parseSave(file: File, path: string) {
  if (file.size > 8_000_000)
    throw new Error(t('存档文件过大，请选择单个 game_data.sav 或 progress.sav。'))
  return readSave(await file.arrayBuffer(), path)
}
async function previewBackup(file: File) {
  if (file.size > 30_000_000)
    throw new Error(t('备份超过 30 MB，请检查文件。'))
  try {
    return backupSchema.parse(JSON.parse(await file.text()))
  }
  catch {
    throw new Error(t('备份格式不正确或版本不受支持，现有数据未改变。'))
  }
}
async function choose(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  const file = files[0]
  if (!file || busy.value)
    return
  const fromFolder = input === folderInput.value
  busy.value = true
  emit('selected')
  error.value = ''
  filename.value = fromFolder ? '' : file.name
  groups.value = []
  backup.value = undefined
  singleSave.value = undefined
  try {
    let found: FolderSaveGroup[] = []
    if (fromFolder) {
      found = await inspectSaveFolder(files)
      if (!found.length)
        throw new Error(t('文件夹里没有找到 game_data.sav 或 progress.sav。'))
    }
    else if (source.value === 'backup' || file.name.toLowerCase().endsWith('.json')) {
      backup.value = await previewBackup(file)
      if (!backup.value.profiles.length) {
        backup.value = undefined
        throw new Error(t('备份里没有存档。'))
      }
    }
    else {
      const snapshot = await parseSave(file, file.name)
      singleSave.value = snapshot
      const mode = snapshot.game === 'totk' ? 'normal' : 'unknown'
      found = [{ id: file.name, root: '', game: snapshot.game, mode, candidates: [{ file, path: file.name, game: snapshot.game, mode, savedAt: file.lastModified }] }]
    }
    groups.value = found
    selected.value = Object.fromEntries(found.map(group => [group.id, group.candidates[0]!.path]))
    enabled.value = Object.fromEntries(found.map(group => [group.id, true]))
    targets.value = Object.fromEntries(found.map(group => [group.id, 'new']))
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('无法读取此存档。')
  }
  finally {
    busy.value = false
    open.value = true
  }
}
async function save() {
  if (busy.value || (!backup.value && count.value === 0))
    return
  busy.value = true
  error.value = ''
  try {
    if (backup.value) {
      const [first] = await restoreBackup(backup.value)
      if (first)
        emit('imported', first)
    }
    else {
      const imports = await Promise.all(groups.value.filter(group => enabled.value[group.id]).map(async (group) => {
        const candidate = group.candidates.find(item => item.path === selected.value[group.id])!
        const snapshot = singleSave.value ?? await parseSave(candidate.file, candidate.path)
        const catalog = await loadCatalog(snapshot.game)
        const matches = props.profiles.filter(profile => profile.game === snapshot.game && profile.snapshot?.fingerprint === snapshot.fingerprint
          && (profile.mode === group.mode || profile.mode === 'unknown' || group.mode === 'unknown'))
        const target = targets.value[group.id] === 'new' ? (matches.length === 1 ? matches[0] : undefined) : props.profiles.find(profile => profile.id === targets.value[group.id])
        return { group, snapshot, catalog, target }
      }))
      const id = await db.transaction('rw', db.profiles, db.imports, async () => {
        let last: SaveProfile | undefined
        for (const { group, snapshot, catalog, target } of imports) {
          const name = group.mode === 'unknown' ? gameLabel(group) : [gameLabel(group), modeLabel(group)].join(' · ')
          last = await saveProfile(snapshot, target?.name ?? name, target?.id, group.mode, catalog)
        }
        return last?.id
      })
      if (id)
        emit('imported', id)
    }
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
  <input ref="fileInput" type="file" accept=".sav,.json,application/json" hidden tabindex="-1" aria-hidden="true" @change="choose">
  <input ref="folderInput" type="file" webkitdirectory multiple hidden tabindex="-1" aria-hidden="true" @change="choose">
  <span v-if="busy && !open" class="import-reading" role="status">{{ t('正在读取…') }}</span>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent class="dialog-content folder-import" :aria-describedby="undefined" @interact-outside="busy && $event.preventDefault()" @escape-key-down="busy && $event.preventDefault()">
        <DialogTitle>{{ title }}</DialogTitle>
        <form v-if="backup || groups.length" @submit.prevent="save">
          <ul v-if="backup" class="backup-profiles">
            <li v-for="profile in backup.profiles" :key="profile.id">
              {{ profile.name }}
            </li>
          </ul>
          <div v-for="group in groups" :key="group.id" class="folder-save-group">
            <label class="folder-save-heading">
              <CheckboxRoot v-if="source === 'folder'" :model-value="enabled[group.id]" class="checkbox" :disabled="busy" @update:model-value="enabled[group.id] = $event === true"><CheckboxIndicator>✓</CheckboxIndicator></CheckboxRoot>
              <strong>{{ gameLabel(group) }}<template v-if="group.mode !== 'unknown'"> · {{ modeLabel(group) }}</template></strong>
            </label>
            <span class="folder-save-path">{{ selected[group.id] }}</span>
            <small v-if="source === 'folder'">{{ new Date(group.candidates.find(item => item.path === selected[group.id])!.savedAt).toLocaleString(currentLocale, { hour12: false }) }}</small>
            <details v-if="group.candidates.length > 1">
              <summary>{{ t('选择其他存档') }} · {{ group.candidates.length }}</summary>
              <AtlasSelect v-model="selected[group.id]" :label="t('存档文件')" :options="group.candidates.map(candidate => ({ value: candidate.path, label: candidate.path }))" :disabled="busy" />
            </details>
            <AtlasSelect v-if="options(group).length > 1" v-model="targets[group.id]" :label="t('导入目标')" :options="options(group)" :disabled="busy" />
          </div>
          <p v-if="error" role="alert" class="error-message">
            {{ t(error) }}
          </p>
          <div class="dialog-actions">
            <button type="button" class="button secondary" :disabled="busy" @click="chooseFile(source)">
              {{ t(source === 'folder' ? '重新选择文件夹' : '重新选择文件') }}
            </button>
            <button class="button primary" type="submit" :disabled="busy || (!backup && count === 0)">
              {{ busy ? t('正在处理…') : backup ? t('恢复备份') : source === 'folder' ? t('导入 {count} 个存档', { count }) : t('导入存档') }}
            </button>
          </div>
        </form>
        <template v-else>
          <p v-if="filename">
            {{ filename }}
          </p>
          <p role="alert" class="error-message">
            {{ t(error) }}
          </p>
          <button class="button primary" :disabled="busy" @click="chooseFile(source)">
            {{ t(source === 'folder' ? '重新选择文件夹' : '重新选择文件') }}
          </button>
        </template>
        <DialogClose class="dialog-close icon-button" :disabled="busy" :aria-label="t('关闭导入窗口')">
          <span class="i-lucide:x" aria-hidden="true" />
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
