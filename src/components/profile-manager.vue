<script setup lang="ts">
import type { SaveProfile } from '@/storage/profiles'
import { AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogOverlay, AlertDialogPortal, AlertDialogRoot, AlertDialogTitle, DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { tr as t } from '@/modules/i18n'
import { downloadBackup } from '@/storage/backup'
import { deleteProfile, renameProfile } from '@/storage/profiles'

defineProps<{ profiles: SaveProfile[] }>()
const emit = defineEmits<{ changed: [], restore: [] }>()
const open = defineModel<boolean>('open', { required: true })
const error = ref('')
const busy = ref(false)
const deletion = shallowRef<SaveProfile>()
const confirm = ref(false)
const editing = ref('')
const name = ref('')
const nameInput = ref<HTMLInputElement[]>([])
watch(open, () => {
  editing.value = ''
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
          <DialogTitle>{{ t('管理存档') }}</DialogTitle>
          <div class="profile-manager-controls">
            <button class="toolbar-control" :aria-label="t('备份')" :title="t('备份')" :disabled="busy || !profiles.length" @click="backup()">
              <span class="i-lucide:download" aria-hidden="true" /><span class="toolbar-label">{{ t('备份') }}</span>
            </button>
            <button class="toolbar-control" :aria-label="t('恢复备份')" :title="t('恢复备份')" :disabled="busy" @click="emit('restore')">
              <span class="i-lucide:upload" aria-hidden="true" /><span class="toolbar-label">{{ t('恢复备份') }}</span>
            </button>
            <DialogClose class="toolbar-control" :aria-label="t('关闭档案管理')" :title="t('关闭档案管理')" :disabled="busy">
              <span class="i-lucide:x" aria-hidden="true" />
            </DialogClose>
          </div>
        </header>
        <ul v-if="profiles.length" class="profile-manager-list">
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
              <strong class="profile-manager-name">{{ profile.name }}</strong>
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
