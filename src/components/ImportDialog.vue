<script setup lang="ts">
import type { GameMode, GameSnapshot } from '@/domain/game'
import type { SaveProfile } from '@/storage/profiles'
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { loadCatalog } from '@/games/catalog'
import { readSave } from '@/games/read-save'
import { saveProfile } from '@/storage/profiles'
import AtlasSelect from './AtlasSelect.vue'

const props = defineProps<{ profiles: SaveProfile[] }>()
const emit = defineEmits<{ imported: [profile: SaveProfile] }>()
const open = defineModel<boolean>('open', { required: true })
const preview = shallowRef<GameSnapshot>()
const name = ref('')
const target = ref('new')
const mode = ref('normal')
const error = ref('')
const busy = ref(false)
const targets = computed(() => [{ value: 'new', label: '创建新的 Profile' }, ...props.profiles.filter(p => p.game === preview.value?.game).map(p => ({ value: p.id, label: `更新：${p.name}` }))])
let revision = 0
watch(open, () => {
  revision++
  preview.value = undefined
  error.value = ''
  busy.value = false
  target.value = 'new'
  mode.value = 'normal'
})
async function choose(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  const request = ++revision
  preview.value = undefined
  error.value = ''
  if (!file)
    return
  busy.value = true
  try {
    if (file.size > 8_000_000)
      throw new Error('存档超过支持的大小，请选择单独的 .sav 文件。')
    const parsed = await readSave(await file.arrayBuffer(), file.name)
    if (request !== revision)
      return
    preview.value = parsed
    target.value = 'new'
    mode.value = 'normal'
    name.value = `${parsed.game.toUpperCase()} · 新的冒险`
  }
  catch (e) {
    if (request === revision)
      error.value = e instanceof Error ? e.message : '无法读取此存档。'
  }
  finally {
    if (request === revision)
      busy.value = false
  }
}
async function save() {
  if (!preview.value)
    return
  busy.value = true
  error.value = ''
  try {
    const catalog = await loadCatalog(preview.value.game)
    const existing = props.profiles.find(p => p.id === target.value)
    const profile = await saveProfile(toRaw(preview.value), existing?.name ?? name.value, existing?.id, mode.value as GameMode, catalog)
    emit('imported', profile)
    open.value = false
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败，请重试。'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" /><DialogContent class="dialog-content" @interact-outside="busy && $event.preventDefault()" @escape-key-down="busy && $event.preventDefault()">
        <DialogTitle>导入一段冒险</DialogTitle><DialogDescription>选择 BOTW 的 game_data.sav 或 TOTK 的 progress.sav，先预览，再保存到 Profile。</DialogDescription>
        <form @submit.prevent="save">
          <label>存档文件<input type="file" accept=".sav" :disabled="busy" @change="choose"></label>
          <p v-if="busy" role="status">
            正在处理…
          </p>
          <div v-if="preview" class="import-preview">
            <strong>{{ preview.game.toUpperCase() }}</strong><span>{{ preview.hearts }} 颗心 · {{ preview.rupees.toLocaleString() }} 卢比</span><span>{{ preview.items.length }} 项背包记录 · {{ preview.horses.length }} 匹马</span><small>SHA-256 {{ preview.fingerprint.slice(0, 16) }}</small>
          </div>
          <template v-if="preview">
            <AtlasSelect v-model="target" label="导入目标" :options="targets" :disabled="busy" />
            <template v-if="target === 'new'">
              <label>Profile 名称<input v-model="name" required maxlength="80" :disabled="busy"></label><AtlasSelect v-if="preview.game === 'botw'" v-model="mode" label="游戏模式" :options="[{ value: 'normal', label: '普通模式' }, { value: 'master', label: '大师模式' }]" :disabled="busy" /><p v-if="preview.game === 'botw'" class="muted">
                模式由你指定；文件名无法可靠区分普通与大师模式。
              </p>
            </template>
            <p v-else class="muted">
              将更新此 Profile 的自动进度，并保留手动标记、笔记和历史记录。
            </p>
          </template>
          <p v-if="error" role="alert" class="error-message">
            {{ error }}
          </p>
          <button class="button primary" type="submit" :disabled="busy || !preview">
            {{ target === 'new' ? '创建 Profile' : '更新这个 Profile' }}
          </button>
        </form>
        <DialogClose class="dialog-close" :disabled="busy" aria-label="关闭导入窗口">
          ×
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
