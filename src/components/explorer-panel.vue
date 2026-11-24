<script setup lang="ts">
import type { CatalogPoint, GameId, PointAnnotation } from '@/domain/game'
import type { ProfileView, SaveProfile } from '@/storage/profiles'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger, PaginationEllipsis, PaginationList, PaginationListItem, PaginationNext, PaginationPrev, PaginationRoot, TabsContent, TabsList, TabsRoot, TabsTrigger, ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
import { useGameLabels } from '@/composables/game-labels'
import { filterRows, resolveRows } from '@/domain/exploration'
import { categoryDisplayOrder, categoryLabel, loadCatalog } from '@/games/catalog'
import { categoryIcon } from '@/games/category-icons'
import { currentLocale, tr as t } from '@/modules/i18n'
import { db, listAnnotations, putAnnotation } from '@/storage/profiles'
import AtlasSelect from './atlas-select.vue'
import PointDetail from './point-detail.vue'
import WorldMap from './world-map.vue'

const props = defineProps<{ profile?: SaveProfile, game: GameId }>()
const emit = defineEmits<{ import: [] }>()
const gameLabels = useGameLabels(() => props.game)
const catalog = shallowRef<CatalogPoint[]>([])
const annotations = shallowRef<PointAnnotation[]>([])
const loading = ref(true)
const error = ref('')
const page = ref(1)
const panelOpen = ref(true)
const compact = useMediaQuery('(max-width: 760px)')
onMounted(() => {
  if (compact.value)
    panelOpen.value = false
})
const pointList = ref<HTMLElement>()
const pageSize = 40
const selected = ref('')
const detailOpen = ref(false)
const focus = ref<[number, number]>()
const defaultView = (profileId: string): ProfileView => ({ profileId, categories: props.profile ? ['shrine', 'korok', 'chest'] : ['shrine'], status: 'incomplete', layer: 'surface', search: '', region: 'all' })
const view = ref(defaultView(props.profile?.id ?? `browse:${props.game}`))
const points = computed(() => catalog.value.map(gameLabels.localize))
const rows = computed(() => resolveRows(props.profile?.snapshot, points.value, annotations.value))
const explorationRows = computed(() => rows.value.filter(row => row.point.at && !row.point.interior))
const categories = computed(() => [...new Set(explorationRows.value.map(row => row.point.category))].sort((a, b) => categoryName(a).localeCompare(categoryName(b), currentLocale.value)))
const regions = computed(() => [{ value: 'all', label: t('所有地区') }, ...[...new Set(explorationRows.value.map(row => row.point.region).filter((r): r is string => !!r))].sort().map(r => ({ value: r, label: gameLabels.text(r) }))])
const filtered = computed(() => filterRows(explorationRows.value, view.value, true))
const categoryProgress = computed(() => {
  const counts = new Map<string, { done: number, total: number }>()
  if (!props.profile)
    return counts
  const matching = filterRows(explorationRows.value, { ...view.value, categories: null, status: 'all' }, true)
  for (const row of matching) {
    if (row.status === 'unknown')
      continue
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
const children = computed(() => rows.value.filter(r => r.point.parentId === selected.value || r.point.id === current.value?.point.relatedChestId))

const categoryOrder = computed(() => [...categoryDisplayOrder.filter(id => categories.value.includes(id)), ...categories.value.filter(id => !categoryDisplayOrder.includes(id))])
function categoryName(category: string) {
  return t(category === 'camp' ? '营地' : categoryLabel(props.game, category))
}

let generation = 0
async function load() {
  const revision = ++generation
  const profileId = props.profile?.id
  loading.value = true
  selected.value = ''
  detailOpen.value = false
  error.value = ''
  try {
    const [data, records, savedView] = await Promise.all([loadCatalog(props.game), profileId ? listAnnotations(profileId) : [], profileId ? db.views.get(profileId) : undefined])
    if (revision !== generation)
      return
    catalog.value = data
    annotations.value = records
    view.value = savedView ? { ...savedView, status: 'incomplete' } : defaultView(profileId ?? `browse:${props.game}`)
    if (view.value.categories?.length) {
      const available = new Set(data.filter(point => point.at && !point.interior).map(point => point.category))
      const selected = view.value.categories.filter(category => available.has(category))
      view.value.categories = selected.length ? selected : defaultView(view.value.profileId).categories
    }
    page.value = 1
  }
  catch (e) {
    if (revision === generation)
      error.value = e instanceof Error ? e.message : t('无法加载探索记录。')
  }
  finally {
    if (revision === generation)
      loading.value = false
  }
}
watch(() => [props.profile?.id, props.game], load, { immediate: true })
watch(() => [view.value.search, view.value.categories?.join(), view.value.region, view.value.layer], () => {
  page.value = 1
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
    error.value = t('筛选条件未能保存，请检查此浏览器的存储空间。')
  }
}, { deep: true, debounce: 250 })
function select(id: string) {
  selected.value = id
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
async function save(annotation: PointAnnotation) {
  if (!props.profile)
    return
  error.value = ''
  try {
    await putAnnotation(annotation)
    if (annotation.profileId === props.profile?.id) {
      annotations.value = await listAnnotations(props.profile?.id)
      if (!filtered.value.some(row => row.point.id === annotation.pointId))
        focus.value = undefined
      detailOpen.value = false
    }
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('记录保存失败。')
  }
}
function locate(point: CatalogPoint) {
  const parent = point.parentId ? points.value.find(p => p.id === point.parentId) : undefined
  const target = parent ?? point
  if (!target.at)
    return
  view.value.layer = target.layer ?? 'surface'
  focus.value = [...target.at]
  detailOpen.value = false
}
</script>

<template>
  <div class="explorer">
    <WorldMap :game="game" :layer="view.layer" :rows="filtered" :focus="focus" @select="select" />
    <CollapsibleRoot v-model:open="panelOpen" class="exploration-panel">
      <header class="exploration-heading">
        <div><span class="eyebrow">{{ game === 'botw' ? t('旷野之息') : t('王国之泪') }}</span><h1>{{ t('探索海拉鲁') }}</h1></div><CollapsibleTrigger class="icon-button panel-collapse" :aria-label="panelOpen ? t('收起探索面板') : t('展开探索面板')">
          <span :class="panelOpen ? 'i-lucide:panel-left-close' : 'i-lucide:panel-left-open'" aria-hidden="true" />
        </CollapsibleTrigger>
      </header>
      <CollapsibleContent class="exploration-body">
        <div v-if="error" class="error-message" role="alert">
          {{ t(error) }}<button @click="load">
            {{ t('重新加载') }}
          </button>
        </div>
        <p v-if="loading" class="panel-loading" role="status">
          {{ t('正在读取探索目录…') }}
        </p>
        <template v-else-if="!error || catalog.length">
          <div class="exploration-filters">
            <label class="atlas-search"><span class="i-lucide:search" aria-hidden="true" /><input v-model="view.search" name="places" autocomplete="off" :aria-label="t('搜索探索记录')" :placeholder="t('搜索地点或物品…')"><button v-if="view.search" class="icon-button" :aria-label="t('清空搜索')" @click="view.search = ''"><span class="i-lucide:x" aria-hidden="true" /></button></label>
            <div class="filter-fields">
              <AtlasSelect :model-value="view.region ?? 'all'" :label="t('地区筛选')" :options="regions" @update:model-value="view.region = $event" />
            </div>
            <ToggleGroupRoot v-if="game === 'totk'" :model-value="view.layer" type="single" class="filter-layers" :aria-label="t('地图层级')" @update:model-value="value => { if (value === 'sky' || value === 'surface' || value === 'depths') view.layer = value }">
              <ToggleGroupItem value="sky">
                {{ t('天空') }}
              </ToggleGroupItem>
              <ToggleGroupItem value="surface">
                {{ t('地表') }}
              </ToggleGroupItem>
              <ToggleGroupItem value="depths">
                {{ t('地底') }}
              </ToggleGroupItem>
            </ToggleGroupRoot>
          </div>
          <TabsRoot default-value="discover" class="exploration-tabs">
            <TabsList class="panel-tabs" :aria-label="t('探索视图')">
              <TabsTrigger value="discover">
                {{ t('探索') }}
              </TabsTrigger>
              <TabsTrigger value="results">
                {{ t('清单') }}<span>{{ filtered.length.toLocaleString(currentLocale) }}</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="discover" class="discover-content">
              <ToggleGroupRoot type="multiple" class="category-tiles" :aria-label="t('筛选点位分类')" :model-value="view.categories ?? categories" @update:model-value="values => view.categories = Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []">
                <ToggleGroupItem v-for="category in categoryOrder" :key="category" :value="category">
                  <span class="category-symbol" :class="categoryIcon(category)" aria-hidden="true" />
                  <strong>{{ categoryName(category) }}</strong>
                  <small v-if="categoryProgress.has(category)" class="category-progress"><span class="sr-only">{{ t('已完成') }} </span>{{ formatCategoryProgress(category) }}</small>
                </ToggleGroupItem>
              </ToggleGroupRoot>
            </TabsContent>
            <TabsContent value="results" class="checklist-content">
              <section ref="pointList" class="point-list" :aria-label="t('探索点位列表')">
                <div v-if="profile && !filtered.length" class="empty-results">
                  <h3>{{ t('当前筛选没有结果') }}</h3>
                </div><button v-for="row in paged" :key="row.point.id" class="point-row" :class="[row.status, { selected: row.point.id === selected }]" @click="select(row.point.id)">
                  <span class="point-symbol" :class="categoryIcon(row.point.category)" aria-hidden="true" /><span class="point-copy"><strong>{{ row.point.name }}</strong><small>{{ row.point.regionLabel ?? row.point.region ?? t(categoryLabel(game, row.point.category)) }}</small></span><span class="point-state"><span class="i-lucide:chevron-right" aria-hidden="true" /><small v-if="row.annotation?.status">{{ t('手动') }}</small></span>
                </button>
              </section>
              <PaginationRoot v-if="pageCount > 1" v-model:page="page" :total="filtered.length" :items-per-page="pageSize" :sibling-count="0" show-edges class="pagination">
                <PaginationList v-slot="{ items }">
                  <PaginationPrev :aria-label="t('上一页')">
                    ‹
                  </PaginationPrev><template v-for="(item, index) in items" :key="index">
                    <PaginationListItem v-if="item.type === 'page'" :value="item.value">
                      {{ item.value }}
                    </PaginationListItem><PaginationEllipsis v-else :index="index">
                      …
                    </PaginationEllipsis>
                  </template><PaginationNext :aria-label="t('下一页')">
                    ›
                  </PaginationNext>
                </PaginationList>
              </PaginationRoot>
            </TabsContent>
          </TabsRoot>
        </template>
      </CollapsibleContent>
    </CollapsibleRoot>
    <PointDetail v-model:open="detailOpen" :game="game" :row="current" :profile-id="profile?.id" :children="children" @save="save" @locate="locate" @select="select" @import="emit('import')" />
  </div>
</template>
