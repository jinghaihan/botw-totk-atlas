<script setup lang="ts">
import type { CatalogPoint, GameId, PointAnnotation } from '@/domain/game'
import type { ProfileView, SaveProfile } from '@/storage/profiles'
import { CheckboxIndicator, CheckboxRoot, CollapsibleContent, CollapsibleRoot, CollapsibleTrigger, PaginationEllipsis, PaginationList, PaginationListItem, PaginationNext, PaginationPrev, PaginationRoot, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger, TabsContent, TabsList, TabsRoot, TabsTrigger, ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
import { useGameLabels } from '@/composables/game-labels'
import { coordinateLabel } from '@/domain/coordinates'
import { filterRows, resolveRows } from '@/domain/exploration'
import { categoryLabels, loadCatalog, statusLabels } from '@/games/catalog'
import { currentLocale, tr as t } from '@/modules/i18n'
import { db, listAnnotations, putAnnotation } from '@/storage/profiles'
import AtlasSelect from './AtlasSelect.vue'
import PointDetail from './PointDetail.vue'
import WorldMap from './WorldMap.vue'

const props = defineProps<{ profile?: SaveProfile, game: GameId }>()
const emit = defineEmits<{ import: [] }>()
const gameLabels = useGameLabels(() => props.game)
const catalog = shallowRef<CatalogPoint[]>([])
const annotations = shallowRef<PointAnnotation[]>([])
const custom = shallowRef<CatalogPoint[]>([])
const loading = ref(true)
const error = ref('')
const page = ref(1)
const panelOpen = ref(true)
const compact = useMediaQuery('(max-width: 760px)')
onMounted(() => {
  if (compact.value)
    panelOpen.value = false
})
const panelTab = ref('discover')
const selected = ref('')
const detailOpen = ref(false)
const placing = ref(false)
const focus = ref<[number, number]>()
const defaultView = (profileId: string): ProfileView => ({ profileId, categories: props.profile ? ['shrine', 'korok', 'chest'] : ['shrine'], status: props.profile ? 'incomplete' : 'all', layer: 'surface', hideIgnored: true, search: '', region: 'all' })
const view = ref(defaultView(props.profile?.id ?? `browse:${props.game}`))
const points = computed(() => [...catalog.value.map(gameLabels.localize), ...custom.value])
const rows = computed(() => resolveRows(props.profile?.snapshot, points.value, annotations.value))
const categories = computed(() => [...new Set(points.value.map(p => p.category))].sort((a, b) => t(categoryLabels[a] ?? a).localeCompare(t(categoryLabels[b] ?? b), currentLocale.value)))
const regions = computed(() => [{ value: 'all', label: t('所有地区') }, ...[...new Set(points.value.map(p => p.region).filter((r): r is string => !!r))].sort().map(r => ({ value: r, label: gameLabels.text(r) }))])
const filtered = computed(() => filterRows(rows.value, view.value))
const mapRows = computed(() => filterRows(rows.value, view.value, true))
const paged = computed(() => filtered.value.slice((page.value - 1) * 40, page.value * 40))
const shrineChestsComplete = computed(() => {
  const shrines = rows.value.filter(row => row.point.category === 'shrine')
  return shrines.length > 0 && shrines.every(row => row.chests?.complete === true)
})
const current = computed(() => rows.value.find(r => r.point.id === selected.value))
const children = computed(() => rows.value.filter(r => r.point.parentId === selected.value || r.point.id === current.value?.point.relatedChestId))
const statuses = computed(() => [{ value: 'all', label: t('全部状态') }, { value: 'incomplete', label: t('未完成') }, { value: 'complete', label: t('已完成') }, { value: 'unknown', label: t('未知 / 手动记录') }, { value: 'found-unfinished', label: t('已发现 · 未完成') }, { value: 'shrine-chests', label: t('已通关 · 宝箱未领完') }])

const categoryIcons: Record<string, string> = { shrine: 'i-lucide:landmark', korok: 'i-lucide:leaf', chest: 'i-lucide:archive', tower: 'i-lucide:radio-tower', lightroot: 'i-lucide:sprout', cave: 'i-lucide:mountain', well: 'i-lucide:circle-dot', camp: 'i-lucide:tent', hinox: 'i-lucide:skull', talus: 'i-lucide:gem', molduga: 'i-lucide:fish', rematch: 'i-lucide:swords', gleeok: 'i-lucide:flame', lynel: 'i-lucide:swords' }
const highlights = computed(() => ['shrine', 'korok', 'chest', 'tower', 'lightroot', 'cave', 'well', 'camp', 'hinox'].filter(id => categories.value.includes(id)))
const categoryCounts = computed(() => {
  const counts: Record<string, { remaining: number, complete: number, unknown: number, total: number }> = {}
  for (const row of rows.value) {
    const count = counts[row.point.category] ??= { remaining: 0, complete: 0, unknown: 0, total: 0 }
    count.total++
    if (row.status === 'complete')
      count.complete++
    else if (row.status === 'unknown')
      count.unknown++
    else if (row.status === 'incomplete' && !row.annotation?.ignored)
      count.remaining++
  }
  return counts
})
function chooseCategory(category: string) {
  view.value.categories = [category]
  view.value.search = ''
  panelTab.value = 'results'
}
function resetFilters() {
  view.value.status = 'all'
  view.value.categories = []
  view.value.search = ''
  view.value.region = 'all'
}
watch(() => view.value.search, (value) => {
  if (value.trim())
    panelTab.value = 'results'
})

let generation = 0
async function load() {
  const revision = ++generation
  const profileId = props.profile?.id
  loading.value = true
  selected.value = ''
  detailOpen.value = false
  placing.value = false
  error.value = ''
  try {
    const [data, notes, savedView, pins] = await Promise.all([loadCatalog(props.game), profileId ? listAnnotations(profileId) : [], profileId ? db.views.get(profileId) : undefined, profileId ? db.pins.where('profileId').equals(profileId).toArray() : []])
    if (revision !== generation)
      return
    catalog.value = data
    annotations.value = notes
    custom.value = pins
    view.value = savedView ?? defaultView(profileId ?? `browse:${props.game}`)
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
watch(() => [view.value.search, view.value.status, view.value.categories.join(), view.value.region, view.value.layer, view.value.hideIgnored], () => {
  page.value = 1
})
watch(() => view.value.status, (status) => {
  if (status === 'shrine-chests')
    view.value.categories = ['shrine']
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
async function place(at: [number, number]) {
  if (!props.profile)
    return
  if (Math.abs(at[0]) > 6000 || Math.abs(at[1]) > 5000)
    return
  try {
    const point = { id: `custom:${crypto.randomUUID()}`, profileId: props.profile.id, name: `${t('营地')} · ${coordinateLabel(at)}`, category: 'camp', at, layer: view.value.layer, rule: 'manual' as const }
    await db.pins.add(point)
    custom.value = [...custom.value, point]
    placing.value = false
    select(point.id)
  }
  catch {
    error.value = t('标记未能保存，请重试。')
  }
}
async function remove(id: string) {
  const profileId = props.profile?.id
  if (!profileId)
    return
  try {
    await db.transaction('rw', db.pins, db.annotations, async () => {
      await db.pins.delete(id)
      await db.annotations.delete([profileId, id])
    })
    custom.value = custom.value.filter(p => p.id !== id)
    annotations.value = annotations.value.filter(a => a.pointId !== id)
    detailOpen.value = false
  }
  catch {
    error.value = t('无法删除标记，请重试。')
  }
}
</script>

<template>
  <div class="explorer">
    <WorldMap :game="game" :layer="view.layer" :rows="mapRows" :focus="focus" :placing="placing" @select="select" @place="place" />
    <CollapsibleRoot v-model:open="panelOpen" class="exploration-panel">
      <header class="exploration-heading">
        <div><span class="eyebrow">{{ game === 'botw' ? t('旷野之息') : t('王国之泪') }}</span><h1>{{ t('探索海拉鲁') }}</h1></div><CollapsibleTrigger class="icon-button panel-collapse" :aria-label="panelOpen ? t('收起探索面板') : t('展开探索面板')">
          <span :class="panelOpen ? 'i-lucide:panel-left-close' : 'i-lucide:panel-left-open'" aria-hidden="true" />
        </CollapsibleTrigger>
      </header>
      <CollapsibleContent class="exploration-body">
        <label class="atlas-search"><span class="i-lucide:search" aria-hidden="true" /><input v-model="view.search" name="places" autocomplete="off" :aria-label="t('搜索探索记录')" :placeholder="t('搜索地点、物品或笔记…')"><button v-if="view.search" class="icon-button" :aria-label="t('清空搜索')" @click="view.search = ''"><span class="i-lucide:x" aria-hidden="true" /></button></label>
        <div v-if="error" class="error-message" role="alert">
          {{ t(error) }}<button @click="load">
            {{ t('重新加载') }}
          </button>
        </div>
        <p v-if="loading" class="panel-loading" role="status">
          {{ t('正在读取探索目录…') }}
        </p>
        <TabsRoot v-else v-model="panelTab" class="exploration-tabs">
          <TabsList class="panel-tabs" :aria-label="t('探索视图')">
            <TabsTrigger value="discover">
              {{ t('探索') }}
            </TabsTrigger><TabsTrigger value="results">
              {{ t('清单') }}<span>{{ filtered.length.toLocaleString(currentLocale) }}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="discover" class="discover-content">
            <div class="panel-section-heading">
              <h2>{{ t('寻找下一站') }}</h2><span>{{ t('按类型探索') }}</span>
            </div>
            <div class="category-tiles">
              <button v-for="category in highlights" :key="category" :aria-pressed="view.categories.includes(category)" @click="chooseCategory(category)">
                <span class="category-symbol" :class="categoryIcons[category] ?? 'i-lucide:map-pin'" aria-hidden="true" /><strong>{{ t(category === 'camp' ? '营地' : categoryLabels[category] ?? category) }}</strong><small>{{ !profile ? t('{count} 个地点', { count: categoryCounts[category]?.total ?? 0 }) : categoryCounts[category]?.unknown === categoryCounts[category]?.total ? t('手动记录') : t('{count} 待探索', { count: categoryCounts[category]?.remaining ?? 0 }) }}</small>
              </button>
            </div>
            <PopoverRoot>
              <PopoverTrigger class="all-categories-link">
                {{ t('所有分类') }}<span class="i-lucide:arrow-up-right" aria-hidden="true" />
              </PopoverTrigger><PopoverPortal>
                <PopoverContent class="category-popover" :side-offset="12" side="right" :aria-label="t('筛选点位分类')">
                  <div class="popover-heading">
                    <strong>{{ t('显示哪些项目') }}</strong><button class="text-button" @click="view.categories = []">
                      {{ t('全部') }}
                    </button>
                  </div><div class="category-checks">
                    <label v-for="c in categories" :key="c"><CheckboxRoot :model-value="view.categories.includes(c)" class="checkbox" @update:model-value="value => view.categories = value ? [...view.categories, c] : view.categories.filter(id => id !== c)"><CheckboxIndicator>✓</CheckboxIndicator></CheckboxRoot>{{ t(categoryLabels[c] ?? c) }}</label>
                  </div>
                </PopoverContent>
              </PopoverPortal>
            </PopoverRoot>
          </TabsContent>
          <TabsContent value="results" class="results-content">
            <div class="result-filters">
              <AtlasSelect v-model="view.status" :label="t('进度筛选')" :options="statuses" /><PopoverRoot>
                <PopoverTrigger class="icon-button" :aria-label="t('更多筛选')">
                  <span class="i-lucide:sliders-horizontal" aria-hidden="true" />
                </PopoverTrigger><PopoverPortal>
                  <PopoverContent class="filter-popover" :side-offset="10" :aria-label="t('更多筛选')">
                    <AtlasSelect :model-value="view.region ?? 'all'" :label="t('地区筛选')" :options="regions" @update:model-value="view.region = $event" /><label class="check-label"><input v-model="view.hideIgnored" type="checkbox">{{ t('隐藏已忽略') }}</label><button class="button secondary" @click="resetFilters">
                      {{ t('重置筛选') }}
                    </button>
                  </PopoverContent>
                </PopoverPortal>
              </PopoverRoot>
            </div>
            <div v-if="view.categories.length" class="active-categories">
              <button v-for="category in view.categories" :key="category" @click="chooseCategory(category)">
                {{ t(category === 'camp' ? '营地' : categoryLabels[category] ?? category) }}
              </button><button class="text-button" @click="view.categories = []">
                {{ t('全部') }}
              </button>
            </div>
            <section class="point-list" :aria-label="t('探索点位列表')">
              <div v-if="!filtered.length" class="empty-results">
                <span class="i-lucide:circle-check" aria-hidden="true" /><h2>{{ view.status === 'shrine-chests' && shrineChestsComplete ? t('神庙宝箱已领完') : t('当前筛选没有结果') }}</h2><p>{{ t('换个分类，继续寻找下一站。') }}</p><button class="button secondary" @click="panelTab = 'discover'">
                  {{ t('返回探索') }}
                </button>
              </div><button v-for="row in paged" :key="row.point.id" class="point-row" :class="[row.status, { selected: row.point.id === selected, ignored: row.annotation?.ignored }]" @click="select(row.point.id)">
                <span class="point-symbol" :class="categoryIcons[row.point.category] ?? 'i-lucide:map-pin'" aria-hidden="true" /><span class="point-copy"><strong>{{ row.point.name }}</strong><small>{{ row.point.regionLabel ?? row.point.region ?? t(categoryLabels[row.point.category] ?? row.point.category) }}</small><small v-if="row.annotation?.note" class="note-excerpt">{{ row.annotation.note }}</small></span><span class="point-state" :aria-label="t(statusLabels[row.status])"><span v-if="row.status === 'complete'" class="i-lucide:check" aria-hidden="true" /><span v-else-if="row.status === 'unknown'">?</span><span v-else class="i-lucide:chevron-right" aria-hidden="true" /><small v-if="row.annotation?.status">{{ t('手动') }}</small></span>
              </button>
            </section>
            <PaginationRoot v-if="filtered.length > 40" v-model:page="page" :total="filtered.length" :items-per-page="40" :sibling-count="0" class="pagination">
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
        <footer class="panel-footnote">
          <span class="i-lucide:hard-drive" aria-hidden="true" /><span>{{ profile ? t('你的记录仅保存在此设备') : t('导入存档后显示收集进度') }}</span><PopoverRoot>
            <PopoverTrigger class="icon-button" :aria-label="t('关于地图数据')">
              <span class="i-lucide:info" aria-hidden="true" />
            </PopoverTrigger><PopoverPortal>
              <PopoverContent class="data-popover" :side-offset="10">
                {{ t('宝箱与收集点来自社区目录。未知字段保留为未知；营地只预置部分宝箱关联点，可自行补充。清单数量不等于游戏地图完成率。') }}
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>
        </footer>
      </CollapsibleContent>
    </CollapsibleRoot>
    <div class="map-actions">
      <button class="map-action" :class="{ active: placing }" :aria-pressed="placing" @click="profile ? placing = !placing : emit('import')">
        <span :class="placing ? 'i-lucide:x' : 'i-lucide:map-pin-plus'" aria-hidden="true" /><span>{{ placing ? t('取消放置') : t('标记营地') }}</span>
      </button>
    </div>
    <ToggleGroupRoot v-if="game === 'totk'" :model-value="view.layer" type="single" class="map-layers" :aria-label="t('地图层级')" @update:model-value="value => { if (value === 'sky' || value === 'surface' || value === 'depths') view.layer = value }">
      <ToggleGroupItem value="sky">
        <span class="i-lucide:cloud" aria-hidden="true" />{{ t('天空') }}
      </ToggleGroupItem><ToggleGroupItem value="surface">
        <span class="i-lucide:mountain" aria-hidden="true" />{{ t('地表') }}
      </ToggleGroupItem><ToggleGroupItem value="depths">
        <span class="i-lucide:layers-2" aria-hidden="true" />{{ t('地底') }}
      </ToggleGroupItem>
    </ToggleGroupRoot>
    <PointDetail v-model:open="detailOpen" :row="current" :profile-id="profile?.id" :children="children" @save="save" @locate="locate" @select="select" @remove="remove" @import="emit('import')" />
  </div>
</template>
