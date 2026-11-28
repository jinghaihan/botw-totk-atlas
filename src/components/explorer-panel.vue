<script setup lang="ts">
import type { ProgressRow } from '@/domain/exploration'
import type { CatalogPoint, GameId, PointAnnotation } from '@/domain/game'
import type { ProfileView, SaveProfile } from '@/storage/profiles'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger, DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, PaginationEllipsis, PaginationList, PaginationListItem, PaginationNext, PaginationPrev, PaginationRoot, SwitchRoot, SwitchThumb, TabsContent, TabsList, TabsRoot, TabsTrigger, ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
import { useGameLabels } from '@/composables/game-labels'
import { AppError } from '@/domain/errors'
import { filterRows, resolveRows } from '@/domain/exploration'
import { categoryDisplayOrder, categoryLabel, loadCatalog } from '@/games/catalog'
import { categoryIcon, pointIcon } from '@/games/category-icons'
import { isExChest } from '@/games/chests'
import { currentLocale, tr as t } from '@/modules/i18n'
import { createProfile, db, listAnnotations, putAnnotation } from '@/storage/profiles'
import CategoryPicker from './category-picker.vue'
import PointDetail from './point-detail.vue'
import WorldMap from './world-map.vue'

const props = defineProps<{ profile?: SaveProfile, game: GameId, mobilePage: string, active: boolean }>()
const emit = defineEmits<{ navigate: [page: 'atlas' | 'checklist'], profileCreated: [profile: SaveProfile] }>()
const gameLabels = useGameLabels(() => props.game)
const catalog = shallowRef<CatalogPoint[]>([])
const annotations = shallowRef<PointAnnotation[]>([])
const loading = ref(true)
const error = shallowRef<AppError>()
const page = ref(1)
const panelOpen = ref(true)
const compact = useMediaQuery('(max-width: 760px)')
const filtersOpen = ref(false)
const pointList = ref<HTMLElement>()
const desktopTab = ref('discover')
const panelTab = computed({
  get: () => compact.value ? 'results' : desktopTab.value,
  set: (value) => { desktopTab.value = value },
})
const listOpen = computed({
  get: () => compact.value || panelOpen.value,
  set: (value) => { panelOpen.value = value },
})
const saving = reactive(new Set<string>())
const creatingProfile = ref(false)
const pageSize = 40
const selected = ref('')
const detailOpen = ref(false)
const worldMap = ref<InstanceType<typeof WorldMap>>()
defineExpose({
  openFilters() {
    detailOpen.value = false
    filtersOpen.value = true
  },
})
watch(() => props.active, (active) => {
  if (!active) {
    detailOpen.value = false
    filtersOpen.value = false
  }
})
watch(() => props.mobilePage, (page) => {
  if (page !== 'atlas')
    detailOpen.value = false
})
const detailFromChecklist = ref(false)
const focus = ref<[number, number]>()
const defaultView = (profileId: string): ProfileView => ({ profileId, categories: props.profile ? ['shrine', 'korok', 'chest'] : ['shrine'], status: 'incomplete', layer: 'surface', search: '' })
const view = ref(defaultView(props.profile?.id ?? `browse:${props.game}`))
async function openPathControls() {
  filtersOpen.value = false
  detailOpen.value = false
  view.value.heroPathVisible = true
  if (compact.value)
    emit('navigate', 'atlas')
  await nextTick()
  worldMap.value?.openControls()
}
const points = computed(() => catalog.value.map(gameLabels.localize))
const rows = computed(() => resolveRows(props.profile?.snapshot, points.value, annotations.value))
const explorationRows = computed(() => rows.value.filter(({ point, automatic }) =>
  point.at && !point.interior && (point.category !== 'location' || !props.profile?.snapshot || automatic !== undefined),
))
const categories = computed(() => [...new Set(explorationRows.value.map(row => row.point.category))].sort((a, b) => categoryName(a).localeCompare(categoryName(b), currentLocale.value)))
const activeView = computed(() => ({ ...view.value, search: panelTab.value === 'results' ? view.value.search : '' }))
const filtered = computed(() => filterRows(explorationRows.value, activeView.value))
const categoryProgress = computed(() => {
  const counts = new Map<string, { done: number, total: number }>()
  if (!props.profile)
    return counts
  const matching = filterRows(explorationRows.value, { ...view.value, categories: null, status: 'all', search: '' })
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
const pageCount = computed(() => Math.ceil(filtered.value.length / pageSize))
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const current = computed(() => rows.value.find(r => r.point.id === selected.value))
const children = computed(() => rows.value.filter(r => r.point.parentId === selected.value))

const categoryOrder = computed(() => [...categoryDisplayOrder.filter(id => categories.value.includes(id)), ...categories.value.filter(id => !categoryDisplayOrder.includes(id))])
const categoryItems = computed(() => categoryOrder.value.map(id => ({
  id,
  label: categoryName(id),
  icon: categoryIcon(props.game, id),
  progress: categoryProgress.value.has(id) ? formatCategoryProgress(id) : '',
})))
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
    const [data, records, savedView] = await Promise.all([loadCatalog(props.game, props.profile?.mode), profileId ? listAnnotations(profileId) : [], profileId ? db.views.get(profileId) : undefined])
    if (revision !== generation)
      return
    catalog.value = data
    annotations.value = records
    if (savedView) {
      const { profileId, categories, layer, search, status, heroPathVisible } = savedView
      view.value = { profileId, categories, layer, search, heroPathVisible, status: status === 'all' ? 'all' : 'incomplete' }
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
watch(() => [props.profile?.id, props.profile?.updatedAt, props.game], load, { immediate: true })
watch(() => [view.value.search, view.value.categories?.join(), view.value.layer, view.value.status], () => {
  page.value = 1
})
watch(() => view.value.status, (status) => {
  if (status === 'incomplete' && current.value?.status === 'complete') {
    selected.value = ''
    focus.value = undefined
    detailOpen.value = false
  }
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
    emit('navigate', 'atlas')
  detailOpen.value = true
  const point = points.value.find(p => p.id === id)
  const parent = point?.parentId ? points.value.find(p => p.id === point.parentId) : undefined
  const target = parent ?? point
  if (target?.at) {
    view.value.layer = target.layer ?? 'surface'
    focus.value = [...target.at]
  }
}
async function save(annotation: PointAnnotation) {
  const { pointId, profileId } = annotation
  if (props.profile?.id !== profileId || saving.has(pointId))
    return
  saving.add(pointId)
  error.value = undefined
  try {
    const record = await putAnnotation(annotation)
    if (props.profile?.id !== profileId)
      return
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
  if (creatingProfile.value)
    return
  if (!profileId) {
    creatingProfile.value = true
    error.value = undefined
    const revision = generation
    const game = props.game
    const savedView = structuredClone(toRaw(view.value))
    try {
      const profile = await db.transaction('rw', [db.profiles, db.annotations, db.views], async () => {
        const profile = await createProfile(game, t(game === 'botw' ? 'game.botw' : 'game.totk'))
        await putAnnotation({ profileId: profile.id, pointId, status: 'complete', updatedAt: new Date().toISOString() })
        await db.views.put({ ...savedView, profileId: profile.id })
        return profile
      })
      if (revision === generation)
        emit('profileCreated', profile)
      await nextTick()
    }
    catch (e) {
      error.value = AppError.from(e, 'error.annotation-save')
    }
    finally {
      creatingProfile.value = false
    }
    return
  }
  const status = row.status === 'incomplete' ? 'complete' : row.automatic === 'complete' ? 'incomplete' : undefined
  await save({ profileId, pointId, status, updatedAt: new Date().toISOString() })
}
</script>

<template>
  <div class="explorer" :class="{ 'mobile-list': compact && mobilePage === 'checklist' }">
    <WorldMap ref="worldMap" :game="game" :layer="view.layer" :rows="filtered" :focus="focus" :preserve-zoom="compact" :focus-offset="compact && detailOpen ? 120 : 0" :hero-path="profile?.heroPath" :hero-path-visible="view.heroPathVisible" :active="active && (!compact || mobilePage === 'atlas') && !detailOpen && !filtersOpen" :panel-open="!compact && panelOpen" @select="select" @playback-layer="view.layer = $event" />
    <CollapsibleRoot v-show="!compact || mobilePage === 'checklist'" v-model:open="listOpen" class="exploration-panel">
      <header class="exploration-heading">
        <div><span class="eyebrow">{{ game === 'botw' ? t('game.botw') : t('game.totk') }}</span><h1>{{ compact ? t('explore.checklist') : t('explore.heading') }}<span v-if="compact" class="mobile-list-count">{{ filtered.length.toLocaleString(currentLocale) }}</span></h1></div><CollapsibleTrigger v-if="!compact" class="icon-button panel-collapse" :aria-label="panelOpen ? t('explore.collapse') : t('explore.expand')">
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
          <div v-if="!compact && profile?.heroPath?.segments.length" class="filter-completed hero-path-toggle" role="group" :aria-label="t('map.hero-path')">
            <span><span class="i-lucide:route" aria-hidden="true" />{{ t('map.hero-path') }}</span>
            <div class="hero-path-actions">
              <button class="icon-button" :aria-label="t('path.open-controls')" :title="t('path.open-controls')" @click="openPathControls">
                <span class="i-lucide:play" aria-hidden="true" />
              </button>
              <SwitchRoot class="filter-completed-switch" :aria-label="t('map.hero-path')" :model-value="!!view.heroPathVisible" @update:model-value="view.heroPathVisible = $event">
                <SwitchThumb class="filter-completed-thumb" />
              </SwitchRoot>
            </div>
          </div>
          <ToggleGroupRoot v-if="!compact && game === 'totk'" :model-value="view.layer" type="single" class="filter-layers" :aria-label="t('map.layers')" @update:model-value="value => { if (value === 'sky' || value === 'surface' || value === 'depths') view.layer = value }">
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
            <div v-if="!compact" class="exploration-tab-bar">
              <TabsList class="panel-tabs" :aria-label="t('explore.views')">
                <TabsTrigger value="discover">
                  {{ t('explore.tab') }}
                </TabsTrigger>
                <TabsTrigger value="results">
                  {{ t('explore.checklist') }}<span>{{ filtered.length.toLocaleString(currentLocale) }}</span>
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
              <CategoryPicker v-model="view.categories" :items="categoryItems" />
            </TabsContent>
            <TabsContent value="results" class="checklist-content">
              <label class="atlas-search"><span class="i-lucide:search" aria-hidden="true" /><input v-model="view.search" name="places" autocomplete="off" :aria-label="t('explore.search')" :placeholder="t('explore.search-placeholder')"><button v-if="view.search" class="icon-button" :aria-label="t('explore.clear-search')" @click="view.search = ''"><span class="i-lucide:x" aria-hidden="true" /></button></label>
              <section ref="pointList" class="point-list" :aria-label="t('explore.point-list')">
                <div v-if="profile && !filtered.length" class="empty-results">
                  <h3>{{ t('explore.no-results') }}</h3>
                </div>
                <div v-for="row in paged" :key="row.point.id" class="point-row" :class="{ selected: row.point.id === selected, complete: row.status === 'complete' }">
                  <button type="button" class="point-row-details" @click="select(row.point.id, true)">
                    <span class="point-symbol" :class="pointIcon(game, row.point)" aria-hidden="true" />
                    <span class="point-copy"><strong><span v-if="isExChest(game, row.point)" class="point-chest-type" :aria-label="t('category.ex-chest')" translate="no">EX</span>{{ row.point.name }}</strong><small>{{ row.point.regionLabel ?? row.point.region ?? categoryLabel(game, row.point.category) }}</small></span>
                    <span v-if="row.status === 'complete'" class="sr-only">{{ t('status.complete') }}</span>
                    <span v-if="row.annotation?.status" class="point-state">
                      <small>{{ t('status.manual') }}</small>
                    </span>
                  </button>
                  <button
                    type="button" class="icon-button point-complete"
                    :aria-label="`${t(row.status === 'complete' ? 'point.mark-incomplete' : 'point.mark-complete')} · ${row.point.name}`"
                    :title="t(row.status === 'complete' ? 'point.mark-incomplete' : 'point.mark-complete')"
                    :disabled="creatingProfile || saving.has(row.point.id)"
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
    <ToggleGroupRoot v-if="compact && mobilePage === 'atlas' && game === 'totk'" :model-value="view.layer" type="single" class="mobile-map-layers filter-layers" :aria-label="t('map.layers')" @update:model-value="value => { if (value === 'sky' || value === 'surface' || value === 'depths') view.layer = value }">
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
    <DialogRoot v-if="compact" v-model:open="filtersOpen">
      <DialogPortal>
        <DialogOverlay class="dialog-overlay mobile-sheet-overlay" />
        <DialogContent class="dialog-content mobile-sheet mobile-filters" :aria-describedby="undefined">
          <header class="mobile-sheet-heading">
            <DialogTitle>{{ t('mobile.filters') }}</DialogTitle>
            <DialogClose class="icon-button" :aria-label="t('point.close')">
              <span class="i-lucide:x" aria-hidden="true" />
            </DialogClose>
          </header>
          <label v-if="profile" class="filter-completed mobile-completed">
            <span>{{ t('explore.show-completed') }}</span>
            <SwitchRoot class="filter-completed-switch" :model-value="view.status === 'all'" @update:model-value="view.status = $event ? 'all' : 'incomplete'">
              <SwitchThumb class="filter-completed-thumb" />
            </SwitchRoot>
          </label>
          <div v-if="profile?.heroPath?.segments.length" class="filter-completed mobile-completed hero-path-toggle" role="group" :aria-label="t('map.hero-path')">
            <span><span class="i-lucide:route" aria-hidden="true" />{{ t('map.hero-path') }}</span>
            <div class="hero-path-actions">
              <button class="icon-button" :aria-label="t('path.open-controls')" :title="t('path.open-controls')" @click="openPathControls">
                <span class="i-lucide:play" aria-hidden="true" />
              </button>
              <SwitchRoot class="filter-completed-switch" :aria-label="t('map.hero-path')" :model-value="!!view.heroPathVisible" @update:model-value="view.heroPathVisible = $event">
                <SwitchThumb class="filter-completed-thumb" />
              </SwitchRoot>
            </div>
          </div>
          <div class="mobile-sheet-body">
            <CategoryPicker v-model="view.categories" :items="categoryItems" />
          </div>
          <footer class="mobile-sheet-footer">
            <DialogClose class="button primary">
              {{ t('mobile.show-results', { count: filtered.length.toLocaleString(currentLocale) }) }}
            </DialogClose>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
    <PointDetail v-model:open="detailOpen" :return-to-list="compact && detailFromChecklist" :game="game" :row="current" :profile-id="profile?.id" :children="children" :show-completion="compact || !detailFromChecklist || !panelOpen" :busy="creatingProfile || (current && saving.has(current.point.id))" @back="detailOpen = false; emit('navigate', 'checklist')" @toggle-complete="toggleChecklistCompletion" @select="select" />
  </div>
</template>
