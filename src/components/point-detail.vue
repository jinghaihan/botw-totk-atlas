<script setup lang="ts">
import type { ProgressRow } from '@/domain/exploration'
import type { CatalogPoint, GameId, PointAnnotation } from '@/domain/game'
import { DialogClose, DialogContent, DialogDescription, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { coordinateLabel } from '@/domain/coordinates'
import { categoryLabel, statusLabels } from '@/games/catalog'
import { categoryIcon } from '@/games/category-icons'
import { tr as t } from '@/modules/i18n'

const props = defineProps<{ game: GameId, row?: ProgressRow, profileId?: string, children: ProgressRow[] }>()
const emit = defineEmits<{ save: [annotation: PointAnnotation], locate: [point: CatalogPoint], select: [id: string], import: [] }>()
const open = defineModel<boolean>('open', { required: true })
function toggleComplete() {
  if (!props.row || !props.profileId)
    return
  emit('save', { profileId: props.profileId, pointId: props.row.point.id, status: props.row.status === 'complete' ? 'incomplete' : 'complete', updatedAt: new Date().toISOString() })
}
</script>

<template>
  <DialogRoot v-model:open="open" :modal="false">
    <DialogPortal>
      <DialogContent v-if="row" class="point-detail" @interact-outside="$event.preventDefault()">
        <div class="detail-category">
          <span :class="categoryIcon(row.point.category)" aria-hidden="true" />{{ categoryLabel(game, row.point.category) }}<span class="detail-status" :data-status="row.status">{{ profileId ? t(statusLabels[row.status]) : t('status.no-save') }}</span>
          <DialogClose class="dialog-close icon-button" :aria-label="t('point.close')">
            <span class="i-lucide:x" aria-hidden="true" />
          </DialogClose>
        </div>
        <DialogTitle>{{ row.point.name }}</DialogTitle><DialogDescription>{{ row.point.regionLabel ?? row.point.region ?? t('game.hyrule') }}</DialogDescription>
        <p v-if="row.point.detail" class="detail-copy">
          {{ row.point.detail }}
        </p>
        <div v-if="row.chests?.complete !== undefined" class="shrine-chest-summary">
          <span :class="categoryIcon('chest')" aria-hidden="true" /><div><strong>{{ t('point.shrine-chests') }}</strong><span>{{ row.chests.complete ? t('status.chests-all-opened') : t('status.chests-not-all-opened') }}</span></div><b v-if="row.chests.total !== null">{{ row.chests.opened }} / {{ row.chests.total }}</b>
        </div>
        <div v-if="children.length" class="child-list">
          <button v-for="child in children" :key="child.point.id" @click="emit('select', child.point.id)">
            <span>{{ child.point.name }}</span><span>{{ child.status === 'complete' ? '✓' : '◇' }}<span class="sr-only">{{ t(statusLabels[child.status]) }}</span></span>
          </button>
        </div>
        <div class="detail-main-actions">
          <button v-if="profileId" class="button primary" @click="toggleComplete">
            <span :class="row.status === 'complete' ? 'i-lucide:rotate-ccw' : 'i-lucide:check'" aria-hidden="true" />{{ row.status === 'complete' ? t('point.mark-incomplete') : t('point.mark-complete') }}
          </button><button v-else class="button primary" @click="emit('import')">
            {{ t('import.save') }}
          </button><button v-if="row.point.at" class="icon-button" :aria-label="t('point.locate')" @click="emit('locate', row.point)">
            <span class="i-lucide:locate-fixed" aria-hidden="true" />
          </button>
        </div>
        <div v-if="row.point.at" class="detail-coordinates">
          <span class="i-lucide:crosshair" aria-hidden="true" /><span translate="no">{{ coordinateLabel(row.point.at) }}</span>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
