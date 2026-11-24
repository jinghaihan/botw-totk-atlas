<script setup lang="ts">
import type { ProgressRow } from '@/domain/exploration'
import type { GameId, MapLayer } from '@/domain/game'
import * as L from 'leaflet'
import { coordinateLabel, mapToWorld, tileUrl, worldToMap } from '@/domain/coordinates'
import { tr as t } from '@/modules/i18n'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'

const props = defineProps<{ game: GameId, layer: MapLayer, rows: ProgressRow[], focus?: [number, number], placing: boolean }>()
const emit = defineEmits<{ select: [id: string], place: [at: [number, number]] }>()
const host = ref<HTMLElement>()
const tileError = ref(false)
const pointer = ref('')
let map: L.Map | undefined
let tiles: L.TileLayer | undefined
let marks: L.MarkerClusterGroup | undefined
let observer: ResizeObserver | undefined
let mounted = false
let alive = true
let focusMarker: L.CircleMarker | undefined
const glyphs: Record<string, string> = { shrine: 'M12 4 21 20H3Z M12 10v4 M12 17v1', korok: 'M19 4C7 3 3 9 6 16c7 5 14-1 13-12ZM5 20l10-11', chest: 'M4 8h16v12H4ZM4 12h16M10 10h4v5h-4ZM6 8V5h12v3', tower: 'M10 4h4l2 16H8ZM6 5 3 8l3 3M18 5l3 3-3 3', lightroot: 'M12 20V9M12 13C4 14 3 7 4 5c6 0 9 3 8 8ZM12 10c0-6 5-8 8-7 1 5-3 8-8 7', cave: 'M2 20 8 6l4 7 3-9 7 16ZM9 20v-4a3 3 0 0 1 6 0v4', well: 'M4 9h16v11H4ZM2 9l10-7 10 7M8 12v5M16 12v5', camp: 'M12 3 22 21H2ZM8 21l4-8 4 8', default: 'M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 7-7ZM10 10h4' }
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
  if (!map || !marks)
    return
  marks.clearLayers()
  const markers: L.Marker[] = []
  for (const row of props.rows) {
    if (!row.point.at)
      continue
    const color = row.status === 'complete' ? '#9ab995' : colors[row.point.category] ?? '#d8bd7f'
    const marker = L.marker(worldToMap(row.point.at), { title: row.point.name, icon: L.divIcon({ className: `atlas-marker ${row.status}`, html: `<svg width="24" height="28" viewBox="0 0 30 34" aria-hidden="true"><path d="M15 1 28 8v16l-13 8L2 24V8Z" fill="${row.status === 'complete' ? '#425d43' : '#253c32'}" stroke="${color}" stroke-width="1.5" opacity="${row.annotation?.ignored ? 0.4 : 1}"/><g transform="translate(3 3)" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="${glyphs[row.point.category] ?? glyphs.default}"/></g></svg>`, iconSize: [24, 28], iconAnchor: [12, 14], tooltipAnchor: [0, -15] }) })
    const label = document.createElement('span')
    label.textContent = row.point.name
    marker.bindTooltip(label, { direction: 'top' }).on('click', (event) => {
      L.DomEvent.stopPropagation(event)
      emit('select', row.point.id)
    })
    markers.push(marker)
  }
  marks.addLayers(markers)
}
function resetView() {
  map?.setView([0, 0], 3.5)
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
onMounted(async () => {
  if (!host.value)
    return
  const global = window as unknown as { L: typeof L }
  if (!global.L?.markerClusterGroup) {
    global.L = { ...L }
    await import('leaflet.markercluster')
  }
  if (!alive)
    return
  const crs = { ...L.CRS.Simple, transformation: new L.Transformation(1 / 64, 93.75, -1 / 64, 78.125) }
  map = L.map(host.value, { crs, center: [0, 0], zoom: 3.5, zoomSnap: 0.5, zoomDelta: 0.5, minZoom: 2, maxZoom: 9, preferCanvas: true, zoomControl: false, maxBounds: [[-5700, -6700], [5700, 6700]], maxBoundsViscosity: 0.8 })
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>')
  L.control.zoom({ position: 'bottomright' }).addTo(map)
  map.on('mousemove', (event) => {
    pointer.value = coordinateLabel(mapToWorld(event.latlng.lat, event.latlng.lng))
  })
  marks = global.L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 52,
    disableClusteringAtZoom: 7,
    animate: false,
    chunkedLoading: true,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: cluster => L.divIcon({ className: 'atlas-cluster', html: `<span>${cluster.getChildCount()}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
  }).addTo(map)
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
  alive = false
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
    <button class="map-reset icon-button" :aria-label="t('俯瞰海拉鲁')" @click="resetView">
      <span class="i-lucide:scan" aria-hidden="true" />
    </button>
    <div v-if="pointer" class="map-coordinates" translate="no">
      {{ pointer }}
    </div>
    <div class="map-legend">
      <span>{{ t('● 未完成') }}</span><span class="muted">{{ t('○ 已完成') }}</span><span>{{ t('◌ 未知') }}</span><span>{{ t('底图需要联网') }}</span>
    </div>
  </div>
</template>
