<script setup lang="ts">
import type { ProgressRow } from '@/domain/exploration'
import type { GameId, MapLayer, PointStatus } from '@/domain/game'
import * as L from 'leaflet'
import horseIcon from '@/assets/icons/horse.svg?raw'
import skullIcon from '@/assets/icons/skull.svg?raw'
import { coordinateLabel, mapToWorld, tileUrl, worldToMap } from '@/domain/coordinates'
import { isMonsterCategory } from '@/games/category-icons'
import { tr as t } from '@/modules/i18n'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'

const props = defineProps<{ game: GameId, layer: MapLayer, rows: ProgressRow[], focus?: [number, number] }>()
const emit = defineEmits<{ select: [id: string] }>()
const host = ref<HTMLElement>()
const zoomHost = ref<HTMLElement>()
const tileError = ref(false)
const pointer = ref('')
let map: L.Map | undefined
let tiles: L.TileLayer | undefined
let backdrop: L.ImageOverlay | undefined
let marks: L.MarkerClusterGroup | undefined
let observer: ResizeObserver | undefined
let mounted = false
let alive = true
let focusMarker: L.CircleMarker | undefined
const skullGlyph = skullIcon.replace(/<!--[\s\S]*?-->/g, '').trim()
const glyphs: Record<string, string> = {
  shrine: 'M12 4 21 20H3Z M12 10v4 M12 17v1',
  korok: 'M19 4C7 3 3 9 6 16c7 5 14-1 13-12ZM5 20l10-11',
  chest: 'M12 2 3 7v10l9 5 9-5V7ZM3 7l9 5 9-5M12 12v10M7.5 4.5l9 5',
  tower: 'M10 4h4l2 16H8ZM6 5 3 8l3 3M18 5l3 3-3 3',
  lightroot: 'M12 20V9M12 13C4 14 3 7 4 5c6 0 9 3 8 8ZM12 10c0-6 5-8 8-7 1 5-3 8-8 7',
  cave: 'M2 20 8 6l4 7 3-9 7 16ZM9 20v-4a3 3 0 0 1 6 0v4',
  well: 'M4 9h16v11H4ZM2 9l10-7 10 7M8 12v5M16 12v5',
  shop: 'M4 10v11h16V10M3 7l2-4h14l2 4v3c0 2-3 2-3 0 0 2-4 2-4 0 0 2-4 2-4 0 0 2-4 2-4 0 0 2-3 2-3 0ZM10 21v-6h4v6',
  default: 'M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 7-7ZM10 10h4',
}
function markerSvg(category: string, status: PointStatus) {
  const color = status === 'complete' ? '#a89e84' : '#d8bd7f'
  const glyph = isMonsterCategory(category) ? skullGlyph : category === 'stable' ? horseIcon : `<path d="${glyphs[category] ?? glyphs.default}"/>`
  const badge = '<path d="m20 25 2 2 4-5" fill="none" stroke="currentColor" stroke-width="2"/>'
  return `<svg width="24" height="28" viewBox="0 0 30 34" aria-hidden="true" style="color:${color}"><path d="M15 1 28 8v16l-13 8L2 24V8Z" fill="${status === 'complete' ? '#3e3b32' : '#292b2c'}" stroke="currentColor" stroke-width="1.5"/><g transform="translate(3 3)" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${glyph}</g>${status === 'incomplete' ? '' : `<circle cx="23" cy="25" r="6" fill="#292b2c"/>${badge}`}</svg>`
}
function base() {
  if (!map)
    return
  tileError.value = false
  tiles?.remove()
  backdrop?.remove()
  if (props.game === 'botw')
    backdrop = L.imageOverlay('https://objmap.zeldamods.org/game_files/maptex/base.png', [[-5000, -6000], [5000, 6000]], { pane: 'atlas-background', interactive: false }).addTo(map)
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
    const marker = L.marker(worldToMap(row.point.at), { title: row.point.name, icon: L.divIcon({ className: `atlas-marker ${row.status}`, html: markerSvg(row.point.category, row.status), iconSize: [24, 28], iconAnchor: [12, 14], tooltipAnchor: [0, -15] }) })
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
  focusMarker?.remove()
  if (!map || !props.focus)
    return
  map.setView(worldToMap(props.focus), Math.max(map.getZoom(), 6))
  focusMarker = L.circleMarker(worldToMap(props.focus), { radius: 15, color: '#e2cb8e', fillOpacity: 0, weight: 2, interactive: false }).addTo(map)
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
  map.createPane('atlas-background').style.zIndex = '150'
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>')
  const zoom = L.control.zoom({ position: 'bottomright' }).addTo(map).getContainer()
  if (zoom)
    zoomHost.value?.append(zoom)
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
  <div class="map-shell">
    <div ref="host" class="world-map" role="region" :aria-label="t('海拉鲁交互地图；也可在旁边的列表选择点位')" />
    <div v-if="tileError" class="map-banner tile-warning" role="status">
      {{ t('底图暂时无法加载，点位列表仍可使用。') }}<button @click="base">
        {{ t('重试底图') }}
      </button>
    </div>
    <div class="map-controls" role="group" :aria-label="t('地图')">
      <div class="map-control-stack">
        <button class="map-reset icon-button" :aria-label="t('俯瞰海拉鲁')" :title="t('俯瞰海拉鲁')" @click="resetView">
          <span class="i-lucide:scan" aria-hidden="true" />
        </button>
        <div ref="zoomHost" class="map-zoom" />
      </div>
      <div v-if="pointer" class="map-coordinates" translate="no">
        {{ pointer }}
      </div>
    </div>
  </div>
</template>
