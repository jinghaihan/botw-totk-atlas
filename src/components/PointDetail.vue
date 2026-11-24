<script setup lang="ts">
import type { ProgressRow } from '@/domain/exploration'
import type { CatalogPoint, PointAnnotation, PointStatus } from '@/domain/game'
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { coordinateLabel } from '@/domain/coordinates'
import { categoryLabels, statusLabels } from '@/games/catalog'
import AtlasSelect from './AtlasSelect.vue'

const props = defineProps<{ row?: ProgressRow, profileId: string, children: ProgressRow[] }>()
const emit = defineEmits<{ save: [annotation: PointAnnotation], locate: [point: CatalogPoint], select: [id: string], remove: [id: string] }>()
const open = defineModel<boolean>('open', { required: true })
const status = ref('auto')
const ignored = ref(false)
const note = ref('')
watch(() => [props.row, open.value], () => {
  status.value = props.row?.annotation?.status ?? 'auto'
  ignored.value = props.row?.annotation?.ignored ?? false
  note.value = props.row?.annotation?.note ?? ''
}, { immediate: true })
function save() {
  if (!props.row)
    return
  emit('save', { profileId: props.profileId, pointId: props.row.point.id, status: status.value === 'auto' ? undefined : status.value as PointStatus, ignored: ignored.value, note: note.value.trim(), updatedAt: new Date().toISOString() })
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" /><DialogContent v-if="row" class="dialog-content point-detail">
        <DialogTitle>{{ row.point.name }}</DialogTitle><DialogDescription>{{ categoryLabels[row.point.category] ?? row.point.category }} · {{ row.point.region ?? '海拉鲁' }}</DialogDescription>
        <div class="evidence">
          <span>存档记录：<strong>{{ statusLabels[row.automatic] }}</strong></span><span v-if="row.annotation?.status">手动记录：{{ statusLabels[row.annotation.status] }}</span><span v-if="row.annotation?.status && row.annotation.status !== row.automatic && row.automatic !== 'unknown'" class="conflict">手动记录与当前存档不同，已保留你的选择。</span>
        </div>
        <p v-if="row.point.detail" class="detail-copy">
          {{ row.point.detail }}
        </p>
        <div v-if="row.chests" class="evidence">
          神庙宝箱：{{ row.chests.complete === true ? '已领完' : row.chests.complete === false ? '尚未领完' : '记录未知' }}<span v-if="row.chests.total !== null">{{ row.chests.opened }} / {{ row.chests.total }}</span>
        </div>
        <div v-if="children.length" class="child-list">
          <button v-for="child in children" :key="child.point.id" @click="emit('select', child.point.id)">
            {{ child.point.name }} <span>{{ statusLabels[child.status] }}</span>
          </button>
        </div>
        <button v-if="row.point.at" class="button secondary" @click="emit('locate', row.point)">
          <span class="i-lucide:locate-fixed" /> 地图定位 · {{ coordinateLabel(row.point.at) }}
        </button>
        <form @submit.prevent="save">
          <AtlasSelect v-model="status" label="完成状态" :options="[{ value: 'auto', label: '跟随存档记录' }, { value: 'complete', label: '手动：已完成' }, { value: 'incomplete', label: '手动：未完成' }, { value: 'unknown', label: '手动：待确认' }]" />
          <label class="check-label"><input v-model="ignored" type="checkbox">忽略此项目（可从筛选中恢复显示）</label>
          <label>冒险笔记<textarea v-model="note" maxlength="4000" rows="3" placeholder="记下路线、想法或稍后要做的事…" /></label>
          <button class="button primary" type="submit">
            保存记录
          </button>
        </form>
        <details class="record-details">
          <summary>存档字段与来源</summary><code>{{ row.point.id }}</code><code>{{ row.point.key ?? '仅支持手动记录' }}</code><p>自动记录来自存档；手动选择不会写入游戏存档。营地与可重复敌人的历史可能无法从存档可靠恢复。</p>
        </details>
        <button v-if="row.point.id.startsWith('custom:')" class="button danger" @click="emit('remove', row.point.id)">
          删除自建标记
        </button>
        <DialogClose class="dialog-close" aria-label="关闭点位详情">
          ×
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
