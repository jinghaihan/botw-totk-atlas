<script setup lang="ts">
import type { ProgressRow } from '@/domain/exploration'
import type { GameId, MapLayer } from '@/domain/game'
import * as L from 'leaflet'
import { mapToWorld, tileUrl, worldToMap } from '@/domain/coordinates'
import { tr as t } from '@/modules/i18n'
import 'leaflet/dist/leaflet.css'

const props = defineProps<{ game: GameId, layer: MapLayer, rows: ProgressRow[], focus?: [number, number], placing: boolean }>()
const emit = defineEmits<{ select: [id: string], place: [at: [number, number]] }>()
const host = ref<HTMLElement>()
const tileError = ref(false)
let map: L.Map | undefined
let tiles: L.TileLayer | undefined
let marks: L.LayerGroup | undefined
let observer: ResizeObserver | undefined
let canvas: L.Canvas | undefined
let mounted = false
let focusMarker: L.CircleMarker | undefined
const colors: Record<string, string> = { shrine: '#84d9ed', korok: '#b0cc7b', chest: '#dfbb77', camp: '#e49980', lightroot: '#8ee9b2', cave: '#c4a98a', well: '#90b5dd', rematch: '#e49980' }
function base() {
  if (!map)
    return
  tileError.value = false
  tiles?.remove()
  tiles = L.tileLayer(tileUrl(props.game, props.layer), {
    minZoom: 2,
    maxZoom: 9,
    maxNativeZoom: 7,
    noWrap: true,
    bounds: [[-5000, -6000], [5000, 6000]],
    attribution: 'Map imagery © Nintendo · <a href="https://objmap.zeldamods.org/" target="_blank" rel="noopener">ZeldaMods</a>',
  }).on('tileerror', () => { tileError.value = true }).addTo(map)
}
function markers() {
  if (!map || !marks || !canvas)
    return
  marks.clearLayers()
  for (const row of props.rows) {
    if (!row.point.at)
      continue
    const marker = L.circleMarker(worldToMap(row.point.at), {
      radius: row.point.category === 'shrine' ? 7 : 5,
      renderer: canvas,
      color: row.status === 'complete' ? '#79af9f' : colors[row.point.category] ?? '#cfbfea',
      fillColor: colors[row.point.category] ?? '#cfbfea',
      fillOpacity: row.status === 'complete' ? 0.18 : 0.85,
      opacity: row.annotation?.ignored ? 0.3 : 0.9,
      weight: row.status === 'unknown' ? 1 : 2,
      dashArray: row.status === 'unknown' ? '2 2' : undefined,
    })
    const label = document.createElement('span')
    label.textContent = row.point.name
    marker.bindTooltip(label).on('click', (e) => {
      L.DomEvent.stopPropagation(e)
      emit('select', row.point.id)
    }).addTo(marks)
  }
}
function locate() {
  if (!map || !props.focus)
    return
  map.setView(worldToMap(props.focus), Math.max(map.getZoom(), 6))
  focusMarker?.remove()
  focusMarker = L.circleMarker(worldToMap(props.focus), { radius: 15, color: '#fff5b6', fillOpacity: 0, weight: 2, interactive: false }).addTo(map)
}
watch(() => [props.game, props.layer], base)
watch(() => props.rows, markers)
watch(() => props.focus, locate)
onMounted(() => {
  if (!host.value)
    return
  const crs = { ...L.CRS.Simple, transformation: new L.Transformation(1 / 64, 93.75, -1 / 64, 78.125) }
  map = L.map(host.value, { crs, center: [0, 0], zoom: 3, minZoom: 2, maxZoom: 9, preferCanvas: true, maxBounds: [[-5700, -6700], [5700, 6700]], maxBoundsViscosity: 0.8 })
  canvas = L.canvas({ padding: 0.5 })
  marks = L.layerGroup().addTo(map)
  base()
  markers()
  locate()
  map.on('click', (e) => {
    if (props.placing)
      emit('place', mapToWorld(e.latlng.lat, e.latlng.lng))
  })
  observer = new ResizeObserver(() => map?.invalidateSize())
  observer.observe(host.value)
  mounted = true
})
onBeforeUnmount(() => {
  if (mounted) {
    observer?.disconnect()
    map?.remove()
  }
})
</script>

<template>
  <div class="map-shell" :class="{ placing }">
    <div ref="host" class="world-map" role="region" :aria-label="t('海拉鲁交互地图；也可在旁边的列表选择点位')" />
    <div v-if="placing" class="map-banner" role="status">
      {{ t('点击地图放置营地标记') }}
    </div>
    <div v-if="tileError" class="map-banner tile-warning" role="status">
      {{ t('底图暂时无法加载，点位列表仍可使用。') }}<button @click="base">
        {{ t('重试底图') }}
      </button>
    </div>
    <div class="map-legend">
      <span>{{ t('● 未完成') }}</span><span class="muted">{{ t('○ 已完成') }}</span><span>{{ t('◌ 未知') }}</span><span>{{ t('底图需要联网') }}</span>
    </div>
  </div>
</template>
