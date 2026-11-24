<script setup lang="ts">
import type { SaveProfile } from '@/storage/profiles'
import { AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogOverlay, AlertDialogPortal, AlertDialogRoot, AlertDialogTitle, DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { tr as t } from '@/modules/i18n'
import { backupSchema, exportBackup, restoreBackup } from '@/storage/backup'
import { deleteProfile, renameProfile } from '@/storage/profiles'

const props = defineProps<{ profiles: SaveProfile[] }>()
const emit = defineEmits<{ changed: [], restored: [id: string] }>()
const open = defineModel<boolean>('open', { required: true })
const error = ref('')
const success = ref('')
const busy = ref(false)
const deletion = shallowRef<SaveProfile>()
const confirm = ref(false)
const names = ref<Record<string, string>>({})
const backup = shallowRef<unknown>()
const backupNames = ref<string[]>([])
watch(() => [props.profiles, open.value], () => {
  names.value = Object.fromEntries(props.profiles.map(p => [p.id, p.name]))
  error.value = ''
  success.value = ''
}, { immediate: true })
async function action(fn: () => Promise<void>) {
  busy.value = true
  error.value = ''
  success.value = ''
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
function rename(p: SaveProfile) {
  return action(async () => {
    await renameProfile(p.id, names.value[p.id] ?? p.name)
    emit('changed')
    success.value = t('名称已保存。')
  })
}
function remove() {
  const p = deletion.value
  if (!p)
    return
  return action(async () => {
    await deleteProfile(p.id)
    emit('changed')
    confirm.value = false
    success.value = t('Profile 已删除。')
  })
}
function download(profileId?: string) {
  return action(async () => {
    const content = await exportBackup(profileId)
    const url = URL.createObjectURL(new Blob([JSON.stringify(content)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `wilds-atlas-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    success.value = profileId ? t('Profile 备份已导出。') : t('备份已导出，包含所有 Profile、笔记、自建营地和导入历史。')
  })
}
async function chooseBackup(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  backup.value = undefined
  backupNames.value = []
  if (!file)
    return
  await action(async () => {
    if (file.size > 30_000_000)
      throw new Error(t('备份超过 30 MB，请检查文件。'))
    const data = backupSchema.safeParse(JSON.parse(await file.text()))
    if (!data.success)
      throw new Error(t('备份格式不正确或版本不受支持，现有数据未改变。'))
    backup.value = data.data
    backupNames.value = data.data.profiles.map(p => p.name)
  })
}
function restore() {
  return action(async () => {
    const ids = await restoreBackup(backup.value)
    emit('changed')
    if (ids[0])
      emit('restored', ids[0])
    backup.value = undefined
    success.value = t('已恢复 {count} 个独立 Profile，现有档案保持不变。', { count: ids.length })
  })
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" /><DialogContent class="dialog-content manager-dialog" @interact-outside="busy && $event.preventDefault()" @escape-key-down="busy && $event.preventDefault()">
        <DialogTitle>{{ t('管理冒险档案') }}</DialogTitle><DialogDescription>{{ t('每个 Profile 独立保存进度、笔记和筛选条件。建议定期导出备份。') }}</DialogDescription>
        <div class="profile-manager-list">
          <form v-for="p in profiles" :key="p.id" @submit.prevent="rename(p)">
            <label :for="`name-${p.id}`">{{ p.game.toUpperCase() }} · {{ p.mode === 'master' ? t('大师模式') : t('普通模式') }}</label><div class="inline-fields">
              <input :id="`name-${p.id}`" v-model="names[p.id]" required maxlength="80" :disabled="busy"><button type="button" class="button secondary" :disabled="busy" :aria-label="t('导出此 Profile')" @click="download(p.id)">
                {{ t('导出') }}
              </button><button type="submit" class="button secondary" :disabled="busy">
                {{ t('保存') }}
              </button><button type="button" class="button danger" :disabled="busy" :aria-label="t('删除 {name}', { name: p.name })" @click="deletion = p; confirm = true">
                {{ t('删除') }}
              </button>
            </div>
          </form>
        </div>
        <div class="backup-controls">
          <h3>{{ t('备份与恢复') }}</h3><p>{{ t('数据保存在当前浏览器，清理网站数据会移除这些档案。') }}</p><button class="button secondary" :disabled="busy || !profiles.length" @click="download()">
            {{ t('导出全部档案') }}
          </button><label class="backup-input">{{ t('选择 Wilds Atlas 备份') }}<input type="file" accept=".json,application/json" :disabled="busy" @change="chooseBackup"></label><div v-if="backup">
            <p>{{ t('将新增 {count} 个 Profile：{names}', { count: backupNames.length, names: backupNames.join(' / ') }) }}</p><button class="button primary" :disabled="busy" @click="restore">
              {{ t('恢复为独立副本') }}
            </button>
          </div>
        </div>
        <p v-if="error" role="alert" class="error-message">
          {{ t(error) }}
        </p><p v-if="success" role="status" class="success-message">
          {{ success }}
        </p><DialogClose class="dialog-close" :disabled="busy" :aria-label="t('关闭档案管理')">
          ×
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
  <AlertDialogRoot v-model:open="confirm">
    <AlertDialogPortal>
      <AlertDialogOverlay class="dialog-overlay" /><AlertDialogContent class="dialog-content">
        <AlertDialogTitle>{{ t('删除「{name}」？', { name: deletion?.name ?? '' }) }}</AlertDialogTitle><AlertDialogDescription>{{ t('这会删除此 Profile 的笔记、标记和导入历史。可先导出备份。') }}</AlertDialogDescription><div class="dialog-actions">
          <AlertDialogCancel class="button secondary" :disabled="busy">
            {{ t('取消') }}
          </AlertDialogCancel><AlertDialogAction class="button danger" :disabled="busy" @click.prevent="remove">
            {{ t('删除 Profile') }}
          </AlertDialogAction>
        </div><p v-if="error" role="alert">
          {{ t(error) }}
        </p>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
