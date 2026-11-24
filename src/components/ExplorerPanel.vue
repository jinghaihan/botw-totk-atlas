<script setup lang="ts">
import type { CatalogPoint, PointAnnotation } from '@/domain/game'
import type { ProfileView, SaveProfile } from '@/storage/profiles'
import { CheckboxIndicator, CheckboxRoot, PaginationEllipsis, PaginationList, PaginationListItem, PaginationNext, PaginationPrev, PaginationRoot, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { coordinateLabel } from '@/domain/coordinates'
import { filterRows, resolveRows } from '@/domain/exploration'
import { categoryLabels, loadCatalog, statusLabels } from '@/games/catalog'
import { db, listAnnotations, putAnnotation } from '@/storage/profiles'
import AtlasSelect from './AtlasSelect.vue'
import PointDetail from './PointDetail.vue'
import WorldMap from './WorldMap.vue'

const props = defineProps<{ profile: SaveProfile }>()
const catalog = shallowRef<CatalogPoint[]>([])
const annotations = shallowRef<PointAnnotation[]>([])
const custom = shallowRef<CatalogPoint[]>([])
const loading = ref(true)
const error = ref('')
const page = ref(1)
const showMap = ref(true)
const selected = ref('')
const detailOpen = ref(false)
const placing = ref(false)
const focus = ref<[number, number]>()
const defaultView = (profileId: string): ProfileView => ({ profileId, categories: ['shrine', 'korok', 'chest'], status: 'incomplete', layer: 'surface', hideIgnored: true, search: '', region: 'all' })
const view = ref(defaultView(props.profile.id))
const points = computed(() => [...catalog.value, ...custom.value])
const rows = computed(() => resolveRows(props.profile.snapshot, points.value, annotations.value))
const categories = computed(() => [...new Set(points.value.map(p => p.category))].sort((a, b) => (categoryLabels[a] ?? a).localeCompare(categoryLabels[b] ?? b, 'zh-CN')))
const regions = computed(() => [{ value: 'all', label: '所有地区' }, ...[...new Set(points.value.map(p => p.region).filter((r): r is string => !!r))].sort().map(r => ({ value: r, label: r }))])
const filtered = computed(() => filterRows(rows.value, view.value))
const mapRows = computed(() => filterRows(rows.value, view.value, true))
const paged = computed(() => filtered.value.slice((page.value - 1) * 40, page.value * 40))
const current = computed(() => rows.value.find(r => r.point.id === selected.value))
const children = computed(() => rows.value.filter(r => r.point.parentId === selected.value))
const statuses = [{ value: 'all', label: '全部状态' }, { value: 'incomplete', label: '未完成' }, { value: 'complete', label: '已完成' }, { value: 'unknown', label: '未知 / 手动记录' }, { value: 'found-unfinished', label: '已发现 · 未完成' }, { value: 'shrine-chests', label: '已通关 · 宝箱未领完' }]
let generation = 0
async function load() {
  const revision = ++generation
  const profileId = props.profile.id
  loading.value = true
  selected.value = ''
  detailOpen.value = false
  placing.value = false
  error.value = ''
  try {
    const [data, notes, savedView, pins] = await Promise.all([loadCatalog(props.profile.game), listAnnotations(profileId), db.views.get(profileId), db.pins.where('profileId').equals(profileId).toArray()])
    if (revision !== generation)
      return
    catalog.value = data
    annotations.value = notes
    custom.value = pins
    view.value = savedView ?? defaultView(profileId)
    page.value = 1
  }
  catch (e) {
    if (revision === generation)
      error.value = e instanceof Error ? e.message : '无法加载探索记录。'
  }
  finally {
    if (revision === generation)
      loading.value = false
  }
}
watch(() => props.profile.id, load, { immediate: true })
watch(() => [view.value.search, view.value.status, view.value.categories.join(), view.value.region, view.value.layer, view.value.hideIgnored], () => {
  page.value = 1
})
watch(() => view.value.status, (status) => {
  if (status === 'shrine-chests')
    view.value.categories = ['shrine']
})
watchDebounced(view, async (value) => {
  if (loading.value || value.profileId !== props.profile.id)
    return
  try {
    await db.views.put(toRaw(value))
  }
  catch {
    error.value = '筛选条件未能保存，请检查此浏览器的存储空间。'
  }
}, { deep: true, debounce: 250 })
function select(id: string) {
  selected.value = id
  detailOpen.value = true
}
async function save(annotation: PointAnnotation) {
  error.value = ''
  try {
    await putAnnotation(annotation)
    if (annotation.profileId === props.profile.id) {
      annotations.value = await listAnnotations(props.profile.id)
      detailOpen.value = false
    }
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : '记录保存失败。'
  }
}
function locate(point: CatalogPoint) {
  const parent = point.parentId ? points.value.find(p => p.id === point.parentId) : undefined
  const target = parent ?? point
  if (!target.at)
    return
  view.value.layer = target.layer ?? 'surface'
  showMap.value = true
  focus.value = [...target.at]
  detailOpen.value = false
}
async function place(at: [number, number]) {
  if (Math.abs(at[0]) > 6000 || Math.abs(at[1]) > 5000)
    return
  try {
    const point = { id: `custom:${crypto.randomUUID()}`, profileId: props.profile.id, name: `营地 · ${coordinateLabel(at)}`, category: 'camp', at, layer: view.value.layer, rule: 'manual' as const }
    await db.pins.add(point)
    custom.value = [...custom.value, point]
    placing.value = false
    select(point.id)
  }
  catch {
    error.value = '标记未能保存，请重试。'
  }
}
async function remove(id: string) {
  try {
    await db.transaction('rw', db.pins, db.annotations, async () => {
      await db.pins.delete(id)
      await db.annotations.delete([props.profile.id, id])
    })
    custom.value = custom.value.filter(p => p.id !== id)
    annotations.value = annotations.value.filter(a => a.pointId !== id)
    detailOpen.value = false
  }
  catch {
    error.value = '无法删除标记，请重试。'
  }
}
</script>

<template>
  <div class="explorer">
    <p class="coverage-note">
      宝箱与收集点来自社区目录。未知字段保留为未知；营地只预置部分宝箱关联点，可自行补充。清单数量不等于游戏地图完成率。
    </p>
    <div v-if="error" class="error-message" role="alert">
      {{ error }} <button class="button secondary" @click="load">
        重新加载
      </button>
    </div>
    <div v-if="loading" class="empty-state" role="status">
      正在读取探索目录…
    </div>
    <template v-else>
      <div class="explorer-toolbar">
        <label class="search-box"><span class="i-lucide:search" /><input v-model="view.search" aria-label="搜索探索记录" placeholder="搜索地点、编号或笔记…"></label>
        <PopoverRoot>
          <PopoverTrigger class="button secondary">
            分类 · {{ view.categories.length || '全部' }} <span class="i-lucide:list-filter" />
          </PopoverTrigger><PopoverPortal>
            <PopoverContent class="category-popover" :side-offset="8" aria-label="筛选点位分类">
              <div class="popover-heading">
                <strong>显示哪些项目</strong><button class="button secondary" @click="view.categories = []">
                  全部
                </button>
              </div><div class="category-checks">
                <label v-for="c in categories" :key="c"><CheckboxRoot :model-value="view.categories.includes(c)" class="checkbox" @update:model-value="value => view.categories = value ? [...view.categories, c] : view.categories.filter(id => id !== c)"><CheckboxIndicator>✓</CheckboxIndicator></CheckboxRoot>{{ categoryLabels[c] ?? c }}</label>
              </div>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <AtlasSelect v-model="view.status" label="进度筛选" :options="statuses" />
        <AtlasSelect :model-value="view.region ?? 'all'" label="地区筛选" :options="regions" @update:model-value="view.region = $event" />
        <label class="check-label"><input v-model="view.hideIgnored" type="checkbox">隐藏已忽略</label>
        <button class="button secondary" :aria-pressed="showMap" @click="showMap = !showMap">
          {{ showMap ? '收起地图' : '展开地图' }}
        </button>
      </div>
      <div class="explorer-meta">
        <span>{{ filtered.length.toLocaleString() }} 项结果 <span v-if="showMap">· 当前地图 {{ mapRows.length.toLocaleString() }} 个点位</span></span><div v-if="showMap" class="layer-controls">
          <AtlasSelect v-if="profile.game === 'totk'" v-model="view.layer" label="地图层级" :options="[{ value: 'sky', label: '天空' }, { value: 'surface', label: '地表' }, { value: 'depths', label: '地底' }]" /><button class="button secondary" :aria-pressed="placing" @click="placing = !placing">
            {{ placing ? '取消放置' : '＋ 记录营地' }}
          </button>
        </div>
      </div>
      <div class="explorer-layout" :class="{ 'list-only': !showMap }">
        <WorldMap v-if="showMap" :game="profile.game" :layer="view.layer" :rows="mapRows" :focus="focus" :placing="placing" @select="select" @place="place" />
        <section class="point-list" aria-label="探索点位列表">
          <p class="list-hint">
            列表包括所有地图层级及无坐标项目。
          </p><div v-if="!filtered.length" class="empty-state compact">
            <span class="i-lucide:circle-check" /><h3>当前筛选没有结果</h3><p>可以切换分类、状态，或恢复显示已忽略项目。</p><button class="button secondary" @click="view.status = 'all'; view.categories = []; view.search = ''; view.region = 'all'">
              查看全部记录
            </button>
          </div>
          <button v-for="row in paged" :key="row.point.id" class="point-row" :class="[row.status, { ignored: row.annotation?.ignored }]" @click="select(row.point.id)">
            <span class="point-symbol">{{ row.status === 'complete' ? '✓' : row.status === 'unknown' ? '?' : '◇' }}</span><span class="point-copy"><strong>{{ row.point.name }}</strong><small>{{ categoryLabels[row.point.category] ?? row.point.category }} · {{ row.point.region ?? (row.point.layer === 'depths' ? '地底' : row.point.layer === 'sky' ? '天空' : '海拉鲁') }}</small><small v-if="row.annotation?.note" class="note-excerpt">{{ row.annotation.note }}</small></span><span class="point-state">{{ statusLabels[row.status] }}<small v-if="row.annotation?.status">手动</small><small v-if="row.chests?.complete === false">宝箱未领完</small></span>
          </button>
        </section>
      </div>
      <PaginationRoot v-if="filtered.length > 40" v-model:page="page" :total="filtered.length" :items-per-page="40" :sibling-count="1" show-edges class="pagination">
        <PaginationList v-slot="{ items }">
          <PaginationPrev aria-label="上一页">
            ‹
          </PaginationPrev><template v-for="(item, index) in items" :key="index">
            <PaginationListItem v-if="item.type === 'page'" :value="item.value">
              {{ item.value }}
            </PaginationListItem><PaginationEllipsis v-else :index="index">
              …
            </PaginationEllipsis>
          </template><PaginationNext aria-label="下一页">
            ›
          </PaginationNext>
        </PaginationList>
      </PaginationRoot>
    </template>
    <PointDetail v-model:open="detailOpen" :row="current" :profile-id="profile.id" :children="children" @save="save" @locate="locate" @select="select" @remove="remove" />
  </div>
</template>
