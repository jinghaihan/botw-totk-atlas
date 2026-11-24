<script setup lang="ts">
import type { SaveProfile } from '@/storage/profiles'
import { AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogOverlay, AlertDialogPortal, AlertDialogRoot, AlertDialogTitle, DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
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
    error.value = e instanceof Error ? e.message : '操作未完成，请重试。'
  }
  finally {
    busy.value = false
  }
}
function rename(p: SaveProfile) {
  return action(async () => {
    await renameProfile(p.id, names.value[p.id] ?? p.name)
    emit('changed')
    success.value = '名称已保存。'
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
    success.value = 'Profile 已删除。'
  })
}
function download() {
  return action(async () => {
    const content = await exportBackup()
    const url = URL.createObjectURL(new Blob([JSON.stringify(content)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `wilds-atlas-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    success.value = '备份已导出，包含所有 Profile、笔记、自建营地和导入历史。'
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
      throw new Error('备份超过 30 MB，请检查文件。')
    const data = backupSchema.safeParse(JSON.parse(await file.text()))
    if (!data.success)
      throw new Error('备份格式不正确或版本不受支持，现有数据未改变。')
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
    success.value = `已恢复 ${ids.length} 个独立 Profile，现有档案保持不变。`
  })
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" /><DialogContent class="dialog-content manager-dialog" @interact-outside="busy && $event.preventDefault()" @escape-key-down="busy && $event.preventDefault()">
        <DialogTitle>管理冒险档案</DialogTitle><DialogDescription>每个 Profile 独立保存进度、笔记和筛选条件。建议定期导出备份。</DialogDescription>
        <div class="profile-manager-list">
          <form v-for="p in profiles" :key="p.id" @submit.prevent="rename(p)">
            <label :for="`name-${p.id}`">{{ p.game.toUpperCase() }} · {{ p.mode === 'master' ? '大师模式' : '普通模式' }}</label><div class="inline-fields">
              <input :id="`name-${p.id}`" v-model="names[p.id]" required maxlength="80" :disabled="busy"><button type="submit" class="button secondary" :disabled="busy">
                保存
              </button><button type="button" class="button danger" :disabled="busy" :aria-label="`删除 ${p.name}`" @click="deletion = p; confirm = true">
                删除
              </button>
            </div>
          </form>
        </div>
        <div class="backup-controls">
          <h3>备份与恢复</h3><p>数据保存在当前浏览器，清理网站数据会移除这些档案。</p><button class="button secondary" :disabled="busy || !profiles.length" @click="download">
            导出全部档案
          </button><label class="backup-input">选择 Wilds Atlas 备份<input type="file" accept=".json,application/json" :disabled="busy" @change="chooseBackup"></label><div v-if="backup">
            <p>将新增 {{ backupNames.length }} 个 Profile：{{ backupNames.join('、') }}</p><button class="button primary" :disabled="busy" @click="restore">
              恢复为独立副本
            </button>
          </div>
        </div>
        <p v-if="error" role="alert" class="error-message">
          {{ error }}
        </p><p v-if="success" role="status" class="success-message">
          {{ success }}
        </p><DialogClose class="dialog-close" :disabled="busy" aria-label="关闭档案管理">
          ×
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
  <AlertDialogRoot v-model:open="confirm">
    <AlertDialogPortal>
      <AlertDialogOverlay class="dialog-overlay" /><AlertDialogContent class="dialog-content">
        <AlertDialogTitle>删除「{{ deletion?.name }}」？</AlertDialogTitle><AlertDialogDescription>这会删除此 Profile 的笔记、标记和导入历史。可先导出备份。</AlertDialogDescription><div class="dialog-actions">
          <AlertDialogCancel class="button secondary" :disabled="busy">
            取消
          </AlertDialogCancel><AlertDialogAction class="button danger" :disabled="busy" @click.prevent="remove">
            删除 Profile
          </AlertDialogAction>
        </div><p v-if="error" role="alert">
          {{ error }}
        </p>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
