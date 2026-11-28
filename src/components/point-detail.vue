<script setup lang="ts">
import type { ProgressRow } from '@/domain/exploration'
import type { GameId } from '@/domain/game'
import { DialogClose, DialogContent, DialogDescription, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { coordinateLabel } from '@/domain/coordinates'
import { categoryLabel, pointCategoryLabel, statusLabels } from '@/games/catalog'
import { categoryIcon } from '@/games/category-icons'
import { tr as t } from '@/modules/i18n'

const props = defineProps<{ game: GameId, row?: ProgressRow, profileId?: string, children: ProgressRow[], showCompletion: boolean, returnToList?: boolean, busy?: boolean }>()
const emit = defineEmits<{ toggleComplete: [row: ProgressRow], select: [id: string], back: [] }>()
const open = defineModel<boolean>('open', { required: true })
const category = computed(() => props.row ? pointCategoryLabel(props.game, props.row.point) : '')
const region = computed(() => props.row?.point.regionLabel ?? props.row?.point.region ?? t('game.hyrule'))
</script>

<template>
  <DialogRoot v-model:open="open" :modal="false">
    <DialogPortal>
      <DialogContent v-if="row" class="point-detail" @interact-outside="$event.preventDefault()">
        <div class="detail-header">
          <DialogTitle>{{ row.point.name }}</DialogTitle>
          <span v-if="profileId" class="detail-status" :data-status="row.status">{{ t(statusLabels[row.status]) }}</span>
          <DialogClose class="dialog-close icon-button" :aria-label="t('point.close')">
            <span class="i-lucide:x" aria-hidden="true" />
          </DialogClose>
        </div>
        <DialogDescription class="detail-meta">
          <span><template v-if="row.point.name !== category">{{ category }} · </template>{{ region }}</span>
          <span v-if="row.point.at" class="detail-coordinates" translate="no">
            <span class="i-lucide:crosshair" aria-hidden="true" />{{ coordinateLabel(row.point.at) }}
          </span>
        </DialogDescription>
        <p v-if="row.point.detail && row.point.detail !== category && row.point.detail !== categoryLabel(game, row.point.category) && row.point.detail !== region" class="detail-copy">
          {{ row.point.detail }}
        </p>
        <div v-if="row.chests?.complete !== undefined" class="shrine-chest-summary">
          <span :class="categoryIcon(game, 'chest')" aria-hidden="true" /><div><strong>{{ t('point.shrine-chests') }}</strong><span>{{ row.chests.complete ? t('status.chests-all-opened') : t('status.chests-not-all-opened') }}</span></div><b v-if="row.chests.total !== null">{{ row.chests.opened }} / {{ row.chests.total }}</b>
        </div>
        <div v-if="children.length" class="child-list">
          <button v-for="child in children" :key="child.point.id" @click="emit('select', child.point.id)">
            <span>{{ child.point.name }}</span><span>{{ child.status === 'complete' ? '✓' : '◇' }}<span class="sr-only">{{ t(statusLabels[child.status]) }}</span></span>
          </button>
        </div>
        <div v-if="returnToList || showCompletion" class="detail-main-actions">
          <button v-if="returnToList" class="detail-back" @click="emit('back')">
            <span class="i-lucide:arrow-left" aria-hidden="true" />{{ t('mobile.back-to-list') }}
          </button>
          <button v-if="showCompletion" class="button primary" :disabled="busy" @click="emit('toggleComplete', row)">
            <span class="detail-action-icon" :class="row.status === 'complete' ? 'i-lucide:rotate-ccw' : 'i-lucide:check'" aria-hidden="true" />
            <span class="detail-action-label">{{ row.status === 'complete' ? t('point.mark-incomplete') : t('point.mark-complete') }}</span>
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
