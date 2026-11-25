<script setup lang="ts">
import type { MessageKey } from '@/modules/i18n'
import type { SaveProfile } from '@/storage/profiles'
import { TabsContent } from 'reka-ui'
import { resolveRows } from '@/domain/exploration'
import { masterCycleName } from '@/domain/game'
import { categoryDisplayOrder, categoryLabel, loadCatalog } from '@/games/catalog'
import { currentLocale, tr as t } from '@/modules/i18n'
import { listAnnotations } from '@/storage/profiles'

const props = defineProps<{ profile: SaveProfile }>()
const manualProgress = shallowRef<{ id: string, label: string, done: number, total: number }[]>([])
const loading = ref(false)
const failed = ref(false)
const progress = computed(() => props.profile.snapshot?.progress ?? manualProgress.value)

onMounted(async () => {
  const { id, game, snapshot } = props.profile
  if (snapshot)
    return
  loading.value = true
  try {
    const [catalog, annotations] = await Promise.all([loadCatalog(game, props.profile.mode), listAnnotations(id)])
    const counts = new Map<string, { done: number, total: number }>()
    for (const { point, status } of resolveRows(undefined, catalog, annotations)) {
      if (!point.at || point.interior)
        continue
      const count = counts.get(point.category) ?? { done: 0, total: 0 }
      count.total += 1
      count.done += Number(status === 'complete')
      counts.set(point.category, count)
    }
    manualProgress.value = categoryDisplayOrder.flatMap((category) => {
      const count = counts.get(category)
      return count ? [{ id: category, label: category, ...count }] : []
    })
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
})
const progressKeys: Partial<Record<string, MessageKey>> = {
  'koroks': 'category.korok',
  'hinoxes': 'category.hinox',
  'taluses': 'category.talus',
  'moldugas': 'category.molduga',
  'compendium': 'category.compendium',
  'shrines': 'progress.shrines-cleared',
  'shrine-chests': 'progress.shrines-with-all-chests',
  'SHRINES_STATUS': 'progress.shrines-cleared',
  'LIGHTROOTS_STATUS': 'category.lightroot',
  'KOROKS_HIDDEN': 'progress.koroks-hidden',
  'KOROKS_CARRY': 'progress.koroks-carry',
  'BUBBULS_DEFEATED': 'category.bubbul',
  'LOCATION_CAVES_VISITED': 'progress.caves',
  'LOCATION_WELLS_VISITED': 'category.well',
  'LOCATIONS_VISITED': 'progress.map-locations',
  'BOSSES_HINOXES_DEFEATED': 'category.hinox',
  'BOSSES_TALUSES_DEFEATED': 'category.talus',
  'BOSSES_MOLDUGAS_DEFEATED': 'category.molduga',
  'BOSSES_FLUX_CONSTRUCT_DEFEATED': 'category.flux',
  'BOSSES_FROXS_DEFEATED': 'category.frox',
  'BOSSES_GLEEOKS_DEFEATED': 'category.gleeok',
  'BOSSES_REMATCH_DEFEATED': 'progress.depths-boss-rematches',
  'SAGE_WILLS_FOUND': 'category.sage-will',
  'TREASURE_MAPS_FOUND': 'category.old-map',
  'ADDISON_COMPLETED': 'category.addison',
}
// Backup snapshots store these labels rather than milestone IDs.
const milestoneKeys = new Map<string, MessageKey>([
  ['剑之试炼', 'progress.trial-of-the-sword'],
  ['英杰们的诗篇', 'progress.champions-ballad'],
  [masterCycleName, 'progress.master-cycle'],
  ['大师摩托 Zero', 'progress.master-cycle'],
  ['通关记录', 'progress.game-clear'],
])
function progressName(id: string, fallback: string) {
  if (!props.profile.snapshot)
    return categoryLabel(props.profile.game, id)
  const key = Object.hasOwn(progressKeys, id) ? progressKeys[id] : undefined
  return key ? t(key) : fallback
}
function milestoneName(label: string) {
  const key = milestoneKeys.get(label)
  return key ? t(key) : label
}
const number = (n: number) => n.toLocaleString(currentLocale.value)
</script>

<template>
  <TabsContent value="progress">
    <div class="section-heading">
      <h2>{{ t('progress.exploration-records') }}</h2>
    </div>
    <p v-if="loading" role="status">
      {{ t('common.loading') }}
    </p>
    <p v-else-if="failed" role="alert" class="error-message">
      {{ t('error.exploration-load') }}
    </p>
    <section v-else class="progress-grid">
      <article v-for="p in progress" :key="p.id" class="progress-card">
        <div class="card-heading">
          <span>{{ progressName(p.id, p.label) }}</span><span class="complete-mark">{{ p.done === p.total ? t('status.complete') : t('status.incomplete') }}</span>
        </div><div class="progress-number">
          {{ number(p.done) }}<span>/ {{ number(p.total) }}</span>
        </div><div class="progress-track">
          <span :style="{ width: `${p.done / p.total * 100}%` }" />
        </div><p>
          {{ p.total - p.done === 0 ? t('progress.all-complete') : t('progress.remaining-count', { count: p.total - p.done }) }}
        </p>
      </article>
    </section>
    <div v-if="profile.snapshot" class="section-heading">
      <h2>{{ t('progress.challenges-and-unlocks') }}</h2>
    </div>
    <section v-if="profile.snapshot" class="milestones">
      <div v-for="m in profile.snapshot.milestones" :key="m.label">
        <strong>{{ milestoneName(m.label) }}</strong><span class="milestone-state" :data-complete="m.complete">{{ milestoneKeys.get(m.label) === 'progress.master-cycle' ? (m.complete ? t('status.unlocked') : t('status.locked')) : (m.complete ? t('status.complete') : t('status.not-yet-complete')) }}</span>
      </div>
    </section>
  </TabsContent>
</template>
