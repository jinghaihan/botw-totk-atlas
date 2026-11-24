<script setup lang="ts">
import type { GameId } from '@/domain/game'
import type { SaveProfile } from '@/storage/profiles'
import { AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogOverlay, AlertDialogPortal, AlertDialogRoot, AlertDialogTitle, DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { tr as t } from '@/modules/i18n'
import { downloadBackup } from '@/storage/backup'
import { createProfile, deleteProfile, renameProfile } from '@/storage/profiles'
import AtlasSelect from './atlas-select.vue'

const props = defineProps<{ profiles: SaveProfile[], activeId: string, game: GameId }>()
const emit = defineEmits<{ changed: [], created: [profileId: string], import: [source?: 'folder'], select: [profileId: string] }>()
const open = defineModel<boolean>('open', { required: true })
const error = ref('')
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
  error.value = ''
})
async function action(fn: () => Promise<void>) {
  if (busy.value)
    return
  busy.value = true
  error.value = ''
  try {
    await fn()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('操作未完成，请重试。')
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
  error.value = ''
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
  error.value = ''
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
          <DialogTitle>{{ t(creating ? '新建档案' : '管理存档') }}</DialogTitle>
          <div class="profile-manager-controls">
            <button v-if="!creating && profiles.length" class="toolbar-control" :aria-label="t('新建档案')" :title="t('新建档案')" :disabled="busy" @click="startCreate">
              <span class="i-lucide:file-plus" aria-hidden="true" />
            </button>
            <button v-if="!creating && profiles.length" class="toolbar-control" :aria-label="t('备份')" :title="t('备份')" :disabled="busy" @click="backup()">
              <span class="i-lucide:save" aria-hidden="true" />
            </button>
            <button v-if="!creating && profiles.length" class="toolbar-control" :aria-label="t('导入')" :title="t('导入')" :disabled="busy" @click="emit('import')">
              <span class="i-lucide:upload" aria-hidden="true" />
            </button>
            <button v-if="!creating" class="toolbar-control" :aria-label="t('导入存档文件夹')" :title="t('导入存档文件夹')" :disabled="busy" @click="emit('import', 'folder')">
              <span class="i-lucide:folder-open" aria-hidden="true" />
            </button>
            <DialogClose class="toolbar-control" :aria-label="t('关闭档案管理')" :title="t('关闭档案管理')" :disabled="busy">
              <span class="i-lucide:x" aria-hidden="true" />
            </DialogClose>
          </div>
        </header>
        <form v-if="creating" @submit.prevent="create">
          <AtlasSelect v-model="selectedGame" :label="t('选择游戏')" :options="[{ value: 'botw', label: t('旷野之息') }, { value: 'totk', label: t('王国之泪') }]" :disabled="busy" />
          <label>
            {{ t('存档名称') }}
            <input ref="createNameInput" v-model="name" name="profile-name" autocomplete="off" required maxlength="80" :disabled="busy">
          </label>
          <div class="dialog-actions">
            <button type="button" class="button secondary" :disabled="busy" @click="creating = false; error = ''">
              {{ t('取消') }}
            </button>
            <button type="submit" class="button primary" :disabled="busy || !name.trim()">
              {{ t('新建档案') }}
            </button>
          </div>
        </form>
        <ul v-else-if="profiles.length" class="profile-manager-list">
          <li v-for="profile in profiles" :key="profile.id" class="profile-manager-row">
            <form v-if="editing === profile.id" class="profile-manager-edit" @submit.prevent="rename(profile)">
              <input ref="nameInput" v-model="name" name="profile-name" :aria-label="t('存档名称')" autocomplete="off" required maxlength="80" :disabled="busy">
              <button type="submit" class="button primary" :disabled="busy">
                {{ t('保存') }}
              </button>
              <button type="button" class="button secondary" :disabled="busy" @click="editing = ''; error = ''">
                {{ t('取消') }}
              </button>
            </form>
            <template v-else>
              <button
                type="button" class="profile-manager-select"
                :aria-current="profile.id === activeId ? 'true' : undefined"
                :aria-label="t('切换到 {name}', { name: profile.name })"
                :disabled="busy"
                @click="selectProfile(profile.id)"
              >
                <span :class="profile.id === activeId ? 'i-lucide:circle-check' : 'i-lucide:circle'" aria-hidden="true" />
                <span class="profile-manager-name">{{ profile.name }}</span>
              </button>
              <div class="profile-row-actions">
                <button class="button secondary" :disabled="busy" :aria-label="t('重命名存档')" @click="editName(profile)">
                  {{ t('重命名') }}
                </button>
                <button class="button secondary" :disabled="busy" :aria-label="t('导出此 Profile')" @click="backup(profile.id)">
                  {{ t('导出') }}
                </button>
                <button class="button danger" :disabled="busy" :aria-label="t('删除 {name}', { name: profile.name })" @click="deletion = profile; confirm = true">
                  {{ t('删除') }}
                </button>
              </div>
            </template>
          </li>
        </ul>
        <div v-else class="profile-manager-empty">
          <p>{{ t('暂无档案') }}</p>
          <div>
            <button type="button" class="button secondary" @click="startCreate">
              {{ t('新建档案') }}
            </button>
            <button type="button" class="button primary" @click="emit('import')">
              {{ t('导入存档') }}
            </button>
          </div>
        </div>
        <p v-if="error && !confirm" role="alert" class="error-message">
          {{ t(error) }}
        </p>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
  <AlertDialogRoot v-model:open="confirm">
    <AlertDialogPortal>
      <AlertDialogOverlay class="dialog-overlay" />
      <AlertDialogContent class="dialog-content" :aria-describedby="undefined">
        <AlertDialogTitle>{{ t('删除「{name}」？', { name: deletion?.name ?? '' }) }}</AlertDialogTitle>
        <div class="dialog-actions">
          <AlertDialogCancel class="button secondary" :disabled="busy">
            {{ t('取消') }}
          </AlertDialogCancel>
          <AlertDialogAction class="button danger" :disabled="busy" @click.prevent="remove">
            {{ t('删除') }}
          </AlertDialogAction>
        </div>
        <p v-if="error" role="alert" class="error-message">
          {{ t(error) }}
        </p>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
