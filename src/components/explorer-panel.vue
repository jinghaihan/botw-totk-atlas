<script setup lang="ts">
import type { ProgressRow } from '@/domain/exploration'
import type { CatalogPoint, GameId, PointAnnotation, PointStatus } from '@/domain/game'
import type { ProfileView, SaveProfile } from '@/storage/profiles'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger, PaginationEllipsis, PaginationList, PaginationListItem, PaginationNext, PaginationPrev, PaginationRoot, SwitchRoot, SwitchThumb, TabsContent, TabsList, TabsRoot, TabsTrigger, ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
import { useGameLabels } from '@/composables/game-labels'
import { AppError } from '@/domain/errors'
import { filterRows, resolveRows } from '@/domain/exploration'
import { categoryDisplayOrder, categoryLabel, loadCatalog } from '@/games/catalog'
import { categoryIcon } from '@/games/category-icons'
import { currentLocale, tr as t } from '@/modules/i18n'
import { db, listAnnotations, putAnnotation } from '@/storage/profiles'
import PointDetail from './point-detail.vue'
import WorldMap from './world-map.vue'

const props = defineProps<{ profile?: SaveProfile, game: GameId }>()
const emit = defineEmits<{ import: [] }>()
const gameLabels = useGameLabels(() => props.game)
const catalog = shallowRef<CatalogPoint[]>([])
const annotations = shallowRef<PointAnnotation[]>([])
const loading = ref(true)
const error = shallowRef<AppError>()
const page = ref(1)
const panelOpen = ref(true)
const compact = useMediaQuery('(max-width: 760px)')
onMounted(() => {
  if (compact.value)
    panelOpen.value = false
})
const pointList = ref<HTMLElement>()
const panelTab = ref('discover')
const completionUndo = shallowRef(new Map<string, PointStatus | undefined>())
const saving = reactive(new Set<string>())
const pageSize = 40
const selected = ref('')
const detailOpen = ref(false)
const detailFromChecklist = ref(false)
const focus = ref<[number, number]>()
const defaultView = (profileId: string): ProfileView => ({ profileId, categories: props.profile ? ['shrine', 'korok', 'chest'] : ['shrine'], status: 'incomplete', layer: 'surface', search: '' })
const view = ref(defaultView(props.profile?.id ?? `browse:${props.game}`))
const points = computed(() => catalog.value.map(gameLabels.localize))
const rows = computed(() => resolveRows(props.profile?.snapshot, points.value, annotations.value))
const explorationRows = computed(() => rows.value.filter(({ point, automatic }) =>
  point.at && !point.interior && (point.category !== 'location' || !props.profile?.snapshot || automatic !== undefined),
))
const categories = computed(() => [...new Set(explorationRows.value.map(row => row.point.category))].sort((a, b) => categoryName(a).localeCompare(categoryName(b), currentLocale.value)))
const activeView = computed(() => ({ ...view.value, search: panelTab.value === 'results' ? view.value.search : '' }))
const filtered = computed(() => filterRows(explorationRows.value, activeView.value, true))
const categoryProgress = computed(() => {
  const counts = new Map<string, { done: number, total: number }>()
  if (!props.profile)
    return counts
  const matching = filterRows(explorationRows.value, { ...view.value, categories: null, status: 'all', search: '' }, true)
  for (const row of matching) {
    const count = counts.get(row.point.category) ?? { done: 0, total: 0 }
    count.total++
    if (row.status === 'complete')
      count.done++
    counts.set(row.point.category, count)
  }
  return counts
})
function formatCategoryProgress(category: string) {
  const count = categoryProgress.value.get(category)
  return count ? `${count.done.toLocaleString(currentLocale.value)} / ${count.total.toLocaleString(currentLocale.value)}` : ''
}
const checklistRows = computed(() => view.value.status === 'incomplete' && completionUndo.value.size
  ? filterRows(explorationRows.value, { ...activeView.value, status: 'all' }, true)
      .filter(row => row.status === 'incomplete' || completionUndo.value.has(row.point.id))
  : filtered.value)
const pageCount = computed(() => Math.ceil(checklistRows.value.length / pageSize))
const paged = computed(() => checklistRows.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const current = computed(() => rows.value.find(r => r.point.id === selected.value))
const children = computed(() => rows.value.filter(r => r.point.parentId === selected.value))

const categoryOrder = computed(() => [...categoryDisplayOrder.filter(id => categories.value.includes(id)), ...categories.value.filter(id => !categoryDisplayOrder.includes(id))])
function categoryName(category: string) {
  return categoryLabel(props.game, category)
}

let generation = 0
async function load() {
  const revision = ++generation
  const profileId = props.profile?.id
  loading.value = true
  selected.value = ''
  detailOpen.value = false
  error.value = undefined
  try {
    const [data, records, savedView] = await Promise.all([loadCatalog(props.game), profileId ? listAnnotations(profileId) : [], profileId ? db.views.get(profileId) : undefined])
    if (revision !== generation)
      return
    catalog.value = data
    annotations.value = records
    if (savedView) {
      const { profileId, categories, layer, search, status } = savedView
      view.value = { profileId, categories, layer, search, status: status === 'all' ? 'all' : 'incomplete' }
    }
    else {
      view.value = defaultView(profileId ?? (`browse:${props.game}`))
    }
    if (view.value.categories?.length) {
      const available = new Set(data.filter(point => point.at && !point.interior).map(point => point.category))
      const selected = view.value.categories.filter(category => available.has(category))
      view.value.categories = selected.length ? selected : defaultView(view.value.profileId).categories
    }
    page.value = 1
  }
  catch (e) {
    if (revision === generation)
      error.value = AppError.from(e, 'error.exploration-load')
  }
  finally {
    if (revision === generation)
      loading.value = false
  }
}
watch(() => [props.profile?.id, props.game], load, { immediate: true })
watch(() => [view.value.search, view.value.categories?.join(), view.value.layer, view.value.status], () => {
  completionUndo.value = new Map()
  page.value = 1
})
watch(() => view.value.status, (status) => {
  if (status === 'incomplete' && current.value?.status === 'complete') {
    selected.value = ''
    focus.value = undefined
    detailOpen.value = false
  }
})
watch(panelTab, () => {
  completionUndo.value = new Map()
})
watch(pageCount, count => page.value = Math.min(page.value, Math.max(1, count)))
watch(page, () => {
  if (pointList.value)
    pointList.value.scrollTop = 0
})
watchDebounced(view, async (value) => {
  if (!props.profile || loading.value || value.profileId !== props.profile.id)
    return
  try {
    await db.views.put(toRaw(value))
  }
  catch {
    error.value = new AppError('error.filters-save')
  }
}, { deep: true, debounce: 250 })
function select(id: string, fromChecklist = false) {
  selected.value = id
  detailFromChecklist.value = fromChecklist
  if (compact.value)
    panelOpen.value = false
  detailOpen.value = true
  const point = points.value.find(p => p.id === id)
  const parent = point?.parentId ? points.value.find(p => p.id === point.parentId) : undefined
  const target = parent ?? point
  if (target?.at) {
    view.value.layer = target.layer ?? 'surface'
    focus.value = [...target.at]
  }
}
async function save(annotation: PointAnnotation, fromChecklist = false) {
  const { pointId, profileId } = annotation
  if (props.profile?.id !== profileId || saving.has(pointId))
    return
  saving.add(pointId)
  error.value = undefined
  try {
    const record = await putAnnotation(annotation)
    if (props.profile?.id !== profileId)
      return
    if (fromChecklist) {
      const next = new Map(completionUndo.value)
      if (next.has(pointId))
        next.delete(pointId)
      else if (annotation.status === 'complete' && panelTab.value === 'results')
        next.set(pointId, annotations.value.find(record => record.pointId === pointId)?.status)
      completionUndo.value = next
    }
    const others = annotations.value.filter(record => record.pointId !== pointId)
    annotations.value = record ? [...others, record] : others
    if (selected.value === pointId) {
      if (!filtered.value.some(row => row.point.id === pointId))
        focus.value = undefined
      detailOpen.value = false
    }
  }
  catch (e) {
    error.value = AppError.from(e, 'error.annotation-save')
  }
  finally {
    saving.delete(pointId)
  }
}
async function toggleChecklistCompletion(row: ProgressRow) {
  const profileId = props.profile?.id
  const pointId = row.point.id
  if (!profileId)
    return
  let status: PointStatus | undefined = 'complete'
  if (completionUndo.value.has(pointId))
    status = completionUndo.value.get(pointId)
  else if (row.status === 'complete')
    status = row.automatic === 'complete' ? 'incomplete' : undefined
  await save({ profileId, pointId, status, updatedAt: new Date().toISOString() }, true)
}
</script>

<template>
  <div class="explorer">
    <WorldMap :game="game" :layer="view.layer" :rows="filtered" :focus="focus" @select="select" />
    <CollapsibleRoot v-model:open="panelOpen" class="exploration-panel">
      <header class="exploration-heading">
        <div><span class="eyebrow">{{ game === 'botw' ? t('game.botw') : t('game.totk') }}</span><h1>{{ t('explore.heading') }}</h1></div><CollapsibleTrigger class="icon-button panel-collapse" :aria-label="panelOpen ? t('explore.collapse') : t('explore.expand')">
          <span :class="panelOpen ? 'i-lucide:panel-left-close' : 'i-lucide:panel-left-open'" aria-hidden="true" />
        </CollapsibleTrigger>
      </header>
      <CollapsibleContent class="exploration-body">
        <div v-if="error" class="error-message" role="alert">
          {{ t(error.key, error.values) }}<button @click="load">
            {{ t('common.reload') }}
          </button>
        </div>
        <p v-if="loading" class="panel-loading" role="status">
          {{ t('explore.loading-catalog') }}
        </p>
        <template v-else-if="!error || catalog.length">
          <ToggleGroupRoot v-if="game === 'totk'" :model-value="view.layer" type="single" class="filter-layers" :aria-label="t('map.layers')" @update:model-value="value => { if (value === 'sky' || value === 'surface' || value === 'depths') view.layer = value }">
            <ToggleGroupItem value="sky">
              {{ t('map.sky') }}
            </ToggleGroupItem>
            <ToggleGroupItem value="surface">
              {{ t('map.surface') }}
            </ToggleGroupItem>
            <ToggleGroupItem value="depths">
              {{ t('map.depths') }}
            </ToggleGroupItem>
          </ToggleGroupRoot>
          <TabsRoot v-model="panelTab" class="exploration-tabs">
            <div class="exploration-tab-bar">
              <TabsList class="panel-tabs" :aria-label="t('explore.views')">
                <TabsTrigger value="discover">
                  {{ t('explore.tab') }}
                </TabsTrigger>
                <TabsTrigger value="results">
                  {{ t('explore.checklist') }}<span>{{ checklistRows.length.toLocaleString(currentLocale) }}</span>
                </TabsTrigger>
              </TabsList>
              <label v-if="profile" class="filter-completed">
                <span>{{ t('explore.show-completed') }}</span>
                <SwitchRoot class="filter-completed-switch" :model-value="view.status === 'all'" @update:model-value="view.status = $event ? 'all' : 'incomplete'">
                  <SwitchThumb class="filter-completed-thumb" />
                </SwitchRoot>
              </label>
            </div>
            <TabsContent value="discover" class="discover-content">
              <ToggleGroupRoot type="multiple" class="category-tiles" :aria-label="t('explore.filter-categories')" :model-value="view.categories ?? categories" @update:model-value="values => view.categories = Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []">
                <ToggleGroupItem v-for="category in categoryOrder" :key="category" :value="category">
                  <span class="category-symbol" :class="categoryIcon(game, category)" aria-hidden="true" />
                  <strong>{{ categoryName(category) }}</strong>
                  <small v-if="categoryProgress.has(category)" class="category-progress"><span class="sr-only">{{ t('status.complete') }} </span>{{ formatCategoryProgress(category) }}</small>
                </ToggleGroupItem>
              </ToggleGroupRoot>
            </TabsContent>
            <TabsContent value="results" class="checklist-content">
              <label class="atlas-search"><span class="i-lucide:search" aria-hidden="true" /><input v-model="view.search" name="places" autocomplete="off" :aria-label="t('explore.search')" :placeholder="t('explore.search-placeholder')"><button v-if="view.search" class="icon-button" :aria-label="t('explore.clear-search')" @click="view.search = ''"><span class="i-lucide:x" aria-hidden="true" /></button></label>
              <section ref="pointList" class="point-list" :aria-label="t('explore.point-list')">
                <div v-if="profile && !checklistRows.length" class="empty-results">
                  <h3>{{ t('explore.no-results') }}</h3>
                </div>
                <div v-for="row in paged" :key="row.point.id" class="point-row" :class="{ selected: row.point.id === selected, complete: row.status === 'complete' }">
                  <button type="button" class="point-row-details" @click="select(row.point.id, true)">
                    <span class="point-symbol" :class="categoryIcon(game, row.point.category)" aria-hidden="true" />
                    <span class="point-copy"><strong>{{ row.point.name }}</strong><small>{{ row.point.regionLabel ?? row.point.region ?? categoryLabel(game, row.point.category) }}</small></span>
                    <span v-if="row.status === 'complete'" class="sr-only">{{ t('status.complete') }}</span>
                    <span v-if="!profile || row.annotation?.status" class="point-state">
                      <span v-if="!profile" class="i-lucide:chevron-right" aria-hidden="true" /><small v-if="row.annotation?.status">{{ t('status.manual') }}</small>
                    </span>
                  </button>
                  <button
                    v-if="profile" type="button" class="icon-button point-complete"
                    :aria-label="`${t(row.status === 'complete' ? 'point.mark-incomplete' : 'point.mark-complete')} · ${row.point.name}`"
                    :title="t(row.status === 'complete' ? 'point.mark-incomplete' : 'point.mark-complete')"
                    :disabled="saving.has(row.point.id)"
                    @click="toggleChecklistCompletion(row)"
                  >
                    <span :class="row.status === 'complete' ? 'i-lucide:undo-2' : 'i-lucide:check'" aria-hidden="true" />
                  </button>
                </div>
              </section>
              <PaginationRoot v-if="pageCount > 1" v-model:page="page" :total="filtered.length" :items-per-page="pageSize" :sibling-count="0" show-edges class="pagination">
                <PaginationList v-slot="{ items }">
                  <PaginationPrev :aria-label="t('common.previous-page')">
                    ‹
                  </PaginationPrev><template v-for="(item, index) in items" :key="index">
                    <PaginationListItem v-if="item.type === 'page'" :value="item.value">
                      {{ item.value }}
                    </PaginationListItem><PaginationEllipsis v-else :index="index">
                      …
                    </PaginationEllipsis>
                  </template><PaginationNext :aria-label="t('common.next-page')">
                    ›
                  </PaginationNext>
                </PaginationList>
              </PaginationRoot>
            </TabsContent>
          </TabsRoot>
        </template>
      </CollapsibleContent>
    </CollapsibleRoot>
    <PointDetail v-model:open="detailOpen" :game="game" :row="current" :profile-id="profile?.id" :children="children" :show-completion="!detailFromChecklist || !panelOpen" @save="save" @select="select" @import="emit('import')" />
  </div>
</template>
