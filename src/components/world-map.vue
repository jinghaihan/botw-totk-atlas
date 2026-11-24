<script setup lang="ts">
import type { ProgressRow } from '@/domain/exploration'
import type { GameId, MapLayer, PointStatus } from '@/domain/game'
import * as L from 'leaflet'
import { coordinateLabel, mapToWorld, tileUrl, worldToMap } from '@/domain/coordinates'
import { categoryIconName, explorationIcons } from '@/games/category-icons'
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
function markerSvg(game: GameId, category: string, status: PointStatus) {
  const color = status === 'complete' ? '#a89e84' : '#d8bd7f'
  const { body } = explorationIcons.icons[categoryIconName(game, category)]
  const badge = '<g class="atlas-marker-check" color="#d8bd7f" stroke="currentColor"><circle cx="24" cy="26" r="5.5" fill="#292b2c"/><path d="m21.5 26 1.5 1.5 3.5-3.5" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g>'
  return `<svg width="24" height="28" viewBox="0 0 30 34" aria-hidden="true" style="color:${color}"><g class="atlas-marker-body"><path d="M15 1 28 8v16l-13 8L2 24V8Z" fill="${status === 'complete' ? '#3e3b32' : '#292b2c'}" stroke="currentColor" stroke-width="1.5"/><g transform="translate(4.44 5.44) scale(.88)">${body}</g></g>${status === 'complete' ? badge : ''}</svg>`
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
    const marker = L.marker(worldToMap(row.point.at), { title: row.point.name, icon: L.divIcon({ className: `atlas-marker ${row.status}`, html: markerSvg(props.game, row.point.category, row.status), iconSize: [24, 28], iconAnchor: [12, 14], tooltipAnchor: [0, -15] }) })
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
    <div ref="host" class="world-map" role="region" :aria-label="t('map.accessible-name')" />
    <div v-if="tileError" class="map-banner tile-warning" role="status">
      {{ t('map.tiles-unavailable') }}<button @click="base">
        {{ t('map.retry-tiles') }}
      </button>
    </div>
    <div class="map-controls" role="group" :aria-label="t('map.title')">
      <div class="map-control-stack">
        <button class="map-reset icon-button" :aria-label="t('map.reset-view')" :title="t('map.reset-view')" @click="resetView">
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
