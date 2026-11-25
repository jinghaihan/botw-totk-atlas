<script setup lang="ts">
import type { GameSnapshot } from '@/domain/game'
import type { FolderSaveGroup } from '@/games/import-folder'
import type { SaveProfile } from '@/storage/profiles'
import { CheckboxIndicator, CheckboxRoot, DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { AppError } from '@/domain/errors'
import { loadCatalog } from '@/games/catalog'
import { readBotwHeroPath, readTotkHeroPath } from '@/games/hero-path'
import { inspectSaveFolder } from '@/games/import-folder'
import { readSave } from '@/games/read-save'
import { currentLocale, tr as t } from '@/modules/i18n'
import { backupSchema, restoreBackup } from '@/storage/backup'
import { db, saveProfile } from '@/storage/profiles'
import AtlasSelect from './atlas-select.vue'

type ImportSource = 'file' | 'folder'
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
const error = shallowRef<AppError>()
const busy = ref(false)
const count = computed(() => groups.value.filter(group => enabled.value[group.id]).length)
const gameLabel = (group: FolderSaveGroup) => group.game === 'botw' ? t('game.botw') : t('game.totk')
const modeLabel = (group: FolderSaveGroup) => group.mode === 'master' ? t('game.master-mode') : t('game.normal-mode')
const title = computed(() => backup.value ? t('import.restore-backup') : source.value === 'folder' ? t('import.folder') : t('import.save'))
function options(group: FolderSaveGroup) {
  const compatible = props.profiles.filter(profile => profile.game === group.game && (group.mode === 'unknown' || profile.mode === group.mode || (!profile.snapshot && profile.mode === 'unknown')))
  return [{ value: 'new', label: t('import.create-profile') }, ...compatible.map(profile => ({ value: profile.id, label: t('import.update-profile', { name: profile.name }) }))]
}
function chooseFile(from: ImportSource = 'file') {
  const input = from === 'folder' ? folderInput.value : fileInput.value
  if (!input || busy.value)
    return
  source.value = from
  input.value = ''
  input.click()
}
defineExpose({ chooseFile })

async function parseSave(file: File, path: string) {
  if (file.size > 8_000_000)
    throw new AppError('error.save-too-large')
  return readSave(await file.arrayBuffer(), path)
}
async function previewBackup(file: File) {
  if (file.size > 30_000_000)
    throw new AppError('error.backup-too-large')
  try {
    return backupSchema.parse(JSON.parse(await file.text()))
  }
  catch {
    throw new AppError('error.backup-invalid')
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
  error.value = undefined
  filename.value = fromFolder ? '' : file.name
  groups.value = []
  backup.value = undefined
  singleSave.value = undefined
  try {
    let found: FolderSaveGroup[] = []
    if (fromFolder) {
      found = await inspectSaveFolder(files)
      if (!found.length)
        throw new AppError('error.folder-no-save')
    }
    else if (file.name.toLowerCase().endsWith('.json')) {
      backup.value = await previewBackup(file)
      if (!backup.value.profiles.length) {
        backup.value = undefined
        throw new AppError('error.backup-empty')
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
    error.value = AppError.from(e, 'error.save-read')
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
  error.value = undefined
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
        const pathBuffers = await Promise.all((candidate.pathFiles ?? []).map(file => file.arrayBuffer()))
        const heroPath = pathBuffers.length ? snapshot.game === 'botw' ? readBotwHeroPath(pathBuffers) : readTotkHeroPath(pathBuffers[0]!) : undefined
        const selectedTarget = targets.value[group.id] ?? 'new'
        if (selectedTarget !== 'new') {
          const target = props.profiles.find(profile => profile.id === selectedTarget)
          const catalog = await loadCatalog(snapshot.game)
          return { group, snapshot, heroPath, catalog, targetId: selectedTarget, name: target?.name }
        }
        const matches = props.profiles.filter(profile => profile.game === snapshot.game && profile.snapshot?.fingerprint === snapshot.fingerprint
          && (profile.mode === group.mode || profile.mode === 'unknown' || group.mode === 'unknown'))
        const target = matches.length === 1 ? matches[0] : undefined
        return { group, snapshot, heroPath, targetId: target?.id, name: target?.name }
      }))
      const id = await db.transaction('rw', [db.profiles, db.annotations], async () => {
        let last: SaveProfile | undefined
        for (const { group, snapshot, heroPath, catalog, targetId, name } of imports) {
          const defaultName = group.mode === 'unknown' ? gameLabel(group) : [gameLabel(group), modeLabel(group)].join(' · ')
          last = await saveProfile(snapshot, name ?? defaultName, targetId, group.mode, catalog, heroPath)
        }
        return last?.id
      })
      if (id)
        emit('imported', id)
    }
    open.value = false
  }
  catch (e) {
    error.value = AppError.from(e, 'error.save-failed')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <input ref="fileInput" type="file" accept=".sav,.json,application/json" hidden tabindex="-1" aria-hidden="true" @change="choose">
  <input ref="folderInput" type="file" webkitdirectory multiple hidden tabindex="-1" aria-hidden="true" @change="choose">
  <span v-if="busy && !open" class="import-reading" role="status">{{ t('common.loading') }}</span>
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
              <summary>{{ t('import.select-other-save') }} · {{ group.candidates.length }}</summary>
              <AtlasSelect v-model="selected[group.id]" :label="t('import.file')" :options="group.candidates.map(candidate => ({ value: candidate.path, label: candidate.path }))" :disabled="busy" />
            </details>
            <AtlasSelect v-if="options(group).length > 1" v-model="targets[group.id]" :label="t('import.target')" :options="options(group)" :disabled="busy" />
          </div>
          <p v-if="error" role="alert" class="error-message">
            {{ t(error.key, error.values) }}
          </p>
          <div class="dialog-actions">
            <button type="button" class="button secondary" :disabled="busy" @click="chooseFile(source)">
              {{ t(source === 'folder' ? 'import.reselect-folder' : 'import.reselect-file') }}
            </button>
            <button class="button primary" type="submit" :disabled="busy || (!backup && count === 0)">
              {{ busy ? t('common.processing') : backup ? t('import.restore-backup') : source === 'folder' ? t('import.save-count', { count }) : t('import.save') }}
            </button>
          </div>
        </form>
        <template v-else>
          <p v-if="filename">
            {{ filename }}
          </p>
          <p v-if="error" role="alert" class="error-message">
            {{ t(error.key, error.values) }}
          </p>
          <button class="button primary" :disabled="busy" @click="chooseFile(source)">
            {{ t(source === 'folder' ? 'import.reselect-folder' : 'import.reselect-file') }}
          </button>
        </template>
        <DialogClose class="dialog-close icon-button" :disabled="busy" :aria-label="t('import.close')">
          <span class="i-lucide:x" aria-hidden="true" />
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
