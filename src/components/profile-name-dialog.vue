<script setup lang="ts">
import type { SaveProfile } from '@/storage/profiles'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { tr as t } from '@/modules/i18n'
import { renameProfile } from '@/storage/profiles'

const props = defineProps<{ profile?: SaveProfile }>()
const emit = defineEmits<{ changed: [] }>()
const open = defineModel<boolean>('open', { required: true })
const name = ref('')
const busy = ref(false)
const error = ref('')
watch(() => [open.value, props.profile?.id], () => {
  name.value = props.profile?.name ?? ''
  error.value = ''
})
async function save() {
  if (!props.profile || busy.value)
    return
  busy.value = true
  error.value = ''
  try {
    await renameProfile(props.profile.id, name.value)
    emit('changed')
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
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent class="dialog-content profile-name-dialog" :aria-describedby="undefined" @interact-outside="busy && $event.preventDefault()" @escape-key-down="busy && $event.preventDefault()">
        <header class="profile-name-heading">
          <DialogTitle>{{ t('重命名存档') }}</DialogTitle>
          <DialogClose class="dialog-close icon-button" :disabled="busy" :aria-label="t('取消')">
            <span class="i-lucide:x" aria-hidden="true" />
          </DialogClose>
        </header>
        <form @submit.prevent="save">
          <label>{{ t('存档名称') }}<input v-model="name" name="profile-name" autocomplete="off" required maxlength="80" :disabled="busy"></label>
          <p v-if="error" role="alert" class="error-message">
            {{ t(error) }}
          </p>
          <div class="dialog-actions">
            <DialogClose class="button secondary" :disabled="busy">
              {{ t('取消') }}
            </DialogClose>
            <button type="submit" class="button primary" :disabled="busy">
              {{ busy ? t('正在处理…') : t('保存') }}
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
