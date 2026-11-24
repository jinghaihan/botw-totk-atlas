<script setup lang="ts">
import type { ProgressRow } from '@/domain/exploration'
import type { CatalogPoint, PointAnnotation, PointStatus } from '@/domain/game'
import { AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogOverlay, AlertDialogPortal, AlertDialogRoot, AlertDialogTitle, DialogClose, DialogContent, DialogDescription, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { coordinateLabel } from '@/domain/coordinates'
import { categoryLabels, statusLabels } from '@/games/catalog'
import { categoryIcon } from '@/games/category-icons'
import { tr as t } from '@/modules/i18n'
import AtlasSelect from './atlas-select.vue'

const props = defineProps<{ row?: ProgressRow, profileId?: string, children: ProgressRow[] }>()
const emit = defineEmits<{ save: [annotation: PointAnnotation], locate: [point: CatalogPoint], select: [id: string], remove: [id: string], import: [] }>()
const open = defineModel<boolean>('open', { required: true })
const confirmDelete = ref(false)
const status = ref('auto')
const ignored = ref(false)
const note = ref('')
watch(() => [props.row?.point.id, open.value], () => {
  status.value = props.row?.annotation?.status ?? 'auto'
  ignored.value = props.row?.annotation?.ignored ?? false
  note.value = props.row?.annotation?.note ?? ''
}, { immediate: true })
function toggleComplete() {
  status.value = props.row?.status === 'complete' ? 'incomplete' : 'complete'
  save()
}
function save() {
  if (!props.row || !props.profileId)
    return
  emit('save', { profileId: props.profileId, pointId: props.row.point.id, status: status.value === 'auto' ? undefined : status.value as PointStatus, ignored: ignored.value, note: note.value.trim(), updatedAt: new Date().toISOString() })
}
</script>

<template>
  <DialogRoot v-model:open="open" :modal="false">
    <DialogPortal>
      <DialogContent v-if="row" class="point-detail" @interact-outside="$event.preventDefault()">
        <div class="detail-category">
          <span :class="categoryIcon(row.point.category)" aria-hidden="true" />{{ t(categoryLabels[row.point.category] ?? row.point.category) }}<span class="detail-status" :data-status="row.status">{{ profileId ? t(statusLabels[row.status]) : t('未导入存档') }}</span>
          <DialogClose class="dialog-close icon-button" :aria-label="t('关闭点位详情')">
            <span class="i-lucide:x" aria-hidden="true" />
          </DialogClose>
        </div>
        <DialogTitle>{{ row.point.name }}</DialogTitle><DialogDescription>{{ row.point.regionLabel ?? row.point.region ?? t('海拉鲁') }}</DialogDescription>
        <p v-if="row.point.detail" class="detail-copy">
          {{ row.point.detail }}
        </p>
        <div v-if="row.chests" class="shrine-chest-summary">
          <span class="i-lucide:archive" aria-hidden="true" /><div><strong>{{ t('神庙宝箱') }}</strong><span>{{ row.chests.complete === true ? t('已领完') : row.chests.complete === false ? t('尚未领完') : t('记录未知') }}</span></div><b v-if="row.chests.total !== null">{{ row.chests.opened }} / {{ row.chests.total }}</b>
        </div>
        <div v-if="children.length" class="child-list">
          <button v-for="child in children" :key="child.point.id" @click="emit('select', child.point.id)">
            <span>{{ child.point.name }}</span><span>{{ child.status === 'complete' ? '✓' : '◇' }}<span class="sr-only">{{ t(statusLabels[child.status]) }}</span></span>
          </button>
        </div>
        <div class="detail-main-actions">
          <button v-if="profileId" class="button primary" @click="toggleComplete">
            <span :class="row.status === 'complete' ? 'i-lucide:rotate-ccw' : 'i-lucide:check'" aria-hidden="true" />{{ row.status === 'complete' ? t('标为未完成') : t('标为已完成') }}
          </button><button v-else class="button primary" @click="emit('import')">
            {{ t('导入存档') }}
          </button><button v-if="row.point.at" class="icon-button" :aria-label="t('地图定位')" @click="emit('locate', row.point)">
            <span class="i-lucide:locate-fixed" aria-hidden="true" />
          </button>
        </div>
        <form v-if="profileId" @submit.prevent="save">
          <label>{{ t('冒险笔记') }}<textarea v-model="note" name="point-note" autocomplete="off" maxlength="4000" rows="3" :placeholder="t('记下路线、想法或稍后要做的事…')" /></label>
          <details class="tracking-options">
            <summary>{{ t('记录选项') }}<span class="i-lucide:chevron-down" aria-hidden="true" /></summary><AtlasSelect v-model="status" :label="t('完成状态')" :options="[{ value: 'auto', label: t('跟随存档记录') }, { value: 'complete', label: t('手动：已完成') }, { value: 'incomplete', label: t('手动：未完成') }, { value: 'unknown', label: t('手动：待确认') }]" /><label class="check-label"><input v-model="ignored" type="checkbox">{{ t('忽略此项目（可从筛选中恢复显示）') }}</label><p class="automatic-evidence">
              {{ t('存档记录：') }}{{ t(statusLabels[row.automatic]) }}
            </p><p v-if="row.annotation?.status && row.annotation.status !== row.automatic && row.automatic !== 'unknown'" class="conflict">
              {{ t('手动记录与当前存档不同，已保留你的选择。') }}
            </p>
          </details>
          <button class="button secondary save-note" type="submit">
            {{ t('保存笔记与记录') }}
          </button>
        </form>
        <div v-if="row.point.at" class="detail-coordinates">
          <span class="i-lucide:crosshair" aria-hidden="true" /><span translate="no">{{ coordinateLabel(row.point.at) }}</span>
        </div>
        <button v-if="row.point.id.startsWith('custom:')" class="button danger delete-custom-point" @click="confirmDelete = true">
          {{ t('删除自建标记') }}
        </button>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
  <AlertDialogRoot v-model:open="confirmDelete">
    <AlertDialogPortal>
      <AlertDialogOverlay class="dialog-overlay" /><AlertDialogContent class="dialog-content">
        <AlertDialogTitle>{{ t('删除自建标记') }}</AlertDialogTitle><AlertDialogDescription>{{ t('删除「{name}」？', { name: row?.point.name ?? '' }) }}</AlertDialogDescription><div class="dialog-actions">
          <AlertDialogCancel class="button secondary">
            {{ t('取消') }}
          </AlertDialogCancel><AlertDialogAction class="button danger" @click="row && emit('remove', row.point.id)">
            {{ t('删除') }}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
