<script setup lang="ts">
import type { GameId } from '@/domain/game'
import type { SaveProfile } from '@/storage/profiles'
import { AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogOverlay, AlertDialogPortal, AlertDialogRoot, AlertDialogTitle, DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { AppError } from '@/domain/errors'
import { tr as t } from '@/modules/i18n'
import { downloadBackup } from '@/storage/backup'
import { createProfile, deleteProfile, renameProfile } from '@/storage/profiles'
import AtlasSelect from './atlas-select.vue'

const props = defineProps<{ profiles: SaveProfile[], activeId: string, game: GameId }>()
const emit = defineEmits<{ changed: [], created: [profileId: string], import: [source?: 'folder'], select: [profileId: string] }>()
const open = defineModel<boolean>('open', { required: true })
const error = shallowRef<AppError>()
const busy = ref(false)
const deletion = shallowRef<SaveProfile>()
const confirm = ref(false)
const editing = ref('')
const creating = ref(false)
const selectedGame = ref<string>(props.game)
const createNameInput = ref<HTMLInputElement>()
const name = ref('')
const nameInput = ref<HTMLInputElement[]>([])
watch(open, () => {
  editing.value = ''
  creating.value = false
  error.value = undefined
})
async function action(fn: () => Promise<void>) {
  if (busy.value)
    return
  busy.value = true
  error.value = undefined
  try {
    await fn()
  }
  catch (e) {
    error.value = AppError.from(e, 'error.operation-failed')
  }
  finally {
    busy.value = false
  }
}
function selectProfile(id: string) {
  emit('select', id)
  open.value = false
}
async function startCreate() {
  selectedGame.value = props.game
  name.value = ''
  editing.value = ''
  error.value = undefined
  creating.value = true
  await nextTick()
  createNameInput.value?.focus()
}
function create() {
  return action(async () => {
    const profile = await createProfile(selectedGame.value === 'totk' ? 'totk' : 'botw', name.value)
    emit('created', profile.id)
    open.value = false
  })
}
async function editName(profile: SaveProfile) {
  editing.value = profile.id
  name.value = profile.name
  error.value = undefined
  await nextTick()
  nameInput.value[0]?.focus()
  nameInput.value[0]?.select()
}
function rename(profile: SaveProfile) {
  return action(async () => {
    await renameProfile(profile.id, name.value)
    editing.value = ''
    emit('changed')
  })
}
function remove() {
  const profile = deletion.value
  if (!profile)
    return
  return action(async () => {
    await deleteProfile(profile.id)
    confirm.value = false
    emit('changed')
  })
}
function backup(profileId?: string) {
  return action(() => downloadBackup(profileId))
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent class="dialog-content manager-dialog" :aria-describedby="undefined" @interact-outside="busy && $event.preventDefault()" @escape-key-down="busy && $event.preventDefault()">
        <header class="profile-manager-header">
          <DialogTitle>{{ t(creating ? 'profile.create' : 'profile.manage') }}</DialogTitle>
          <div class="profile-manager-controls">
            <button v-if="!creating && profiles.length" class="toolbar-control" :aria-label="t('profile.create')" :title="t('profile.create')" :disabled="busy" @click="startCreate">
              <span class="i-lucide:file-plus" aria-hidden="true" />
            </button>
            <button v-if="!creating && profiles.length" class="toolbar-control" :aria-label="t('profile.backup')" :title="t('profile.backup')" :disabled="busy" @click="backup()">
              <span class="i-lucide:save" aria-hidden="true" />
            </button>
            <button v-if="!creating" class="toolbar-control" :aria-label="t('import.single-file')" :title="t('import.single-file')" :disabled="busy" @click="emit('import')">
              <span class="i-lucide:upload" aria-hidden="true" />
            </button>
            <button v-if="!creating && profiles.length" class="toolbar-control" :aria-label="t('import.folder')" :title="t('import.folder')" :disabled="busy" @click="emit('import', 'folder')">
              <span class="i-lucide:folder-open" aria-hidden="true" />
            </button>
            <DialogClose class="toolbar-control" :aria-label="t('profile.close-manager')" :title="t('profile.close-manager')" :disabled="busy">
              <span class="i-lucide:x" aria-hidden="true" />
            </DialogClose>
          </div>
        </header>
        <form v-if="creating" @submit.prevent="create">
          <AtlasSelect v-model="selectedGame" :label="t('game.select')" :options="[{ value: 'botw', label: t('game.botw') }, { value: 'totk', label: t('game.totk') }]" :disabled="busy" />
          <label>
            {{ t('profile.name') }}
            <input ref="createNameInput" v-model="name" name="profile-name" autocomplete="off" required maxlength="80" :disabled="busy">
          </label>
          <div class="dialog-actions">
            <button type="button" class="button secondary" :disabled="busy" @click="creating = false; error = undefined">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" class="button primary" :disabled="busy || !name.trim()">
              {{ t('profile.create') }}
            </button>
          </div>
        </form>
        <ul v-else-if="profiles.length" class="profile-manager-list">
          <li v-for="profile in profiles" :key="profile.id" class="profile-manager-row">
            <form v-if="editing === profile.id" class="profile-manager-edit" @submit.prevent="rename(profile)">
              <input ref="nameInput" v-model="name" name="profile-name" :aria-label="t('profile.name')" autocomplete="off" required maxlength="80" :disabled="busy">
              <button type="submit" class="button primary" :disabled="busy">
                {{ t('common.save') }}
              </button>
              <button type="button" class="button secondary" :disabled="busy" @click="editing = ''; error = undefined">
                {{ t('common.cancel') }}
              </button>
            </form>
            <template v-else>
              <button
                type="button" class="profile-manager-select"
                :aria-current="profile.id === activeId ? 'true' : undefined"
                :aria-label="t('profile.switch-to', { name: profile.name })"
                :disabled="busy"
                @click="selectProfile(profile.id)"
              >
                <span :class="profile.id === activeId ? 'i-lucide:circle-check' : 'i-lucide:circle'" aria-hidden="true" />
                <span class="profile-manager-name">{{ profile.name }}</span>
              </button>
              <div class="profile-row-actions">
                <button class="button secondary" :disabled="busy" :aria-label="t('profile.rename-save')" @click="editName(profile)">
                  {{ t('profile.rename') }}
                </button>
                <button class="button secondary" :disabled="busy" :aria-label="t('profile.export-one')" @click="backup(profile.id)">
                  {{ t('profile.export') }}
                </button>
                <button class="button danger" :disabled="busy" :aria-label="t('profile.delete-name', { name: profile.name })" @click="deletion = profile; confirm = true">
                  {{ t('common.delete') }}
                </button>
              </div>
            </template>
          </li>
        </ul>
        <div v-else class="profile-manager-empty">
          <p>{{ t('profile.empty') }}</p>
          <div>
            <button type="button" class="button secondary" @click="startCreate">
              {{ t('profile.create') }}
            </button>
            <button type="button" class="button primary" @click="emit('import', 'folder')">
              {{ t('import.save') }}
            </button>
          </div>
        </div>
        <p v-if="error && !confirm" role="alert" class="error-message">
          {{ t(error.key, error.values) }}
        </p>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
  <AlertDialogRoot v-model:open="confirm">
    <AlertDialogPortal>
      <AlertDialogOverlay class="dialog-overlay" />
      <AlertDialogContent class="dialog-content" :aria-describedby="undefined">
        <AlertDialogTitle>{{ t('profile.confirm-delete', { name: deletion?.name ?? '' }) }}</AlertDialogTitle>
        <div class="dialog-actions">
          <AlertDialogCancel class="button secondary" :disabled="busy">
            {{ t('common.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction class="button danger" :disabled="busy" @click.prevent="remove">
            {{ t('common.delete') }}
          </AlertDialogAction>
        </div>
        <p v-if="error" role="alert" class="error-message">
          {{ t(error.key, error.values) }}
        </p>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
