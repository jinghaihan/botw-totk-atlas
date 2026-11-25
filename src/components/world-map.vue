<script setup lang="ts">
import type { ProgressRow } from '@/domain/exploration'
import type { CatalogPoint, GameId, MapLayer, PointStatus } from '@/domain/game'
import type { HeroPath } from '@/games/hero-path'
import * as L from 'leaflet'
import { useHeroPathPlayback } from '@/composables/hero-path-playback'
import { coordinateLabel, mapToWorld, tileUrl, worldToMap } from '@/domain/coordinates'
import { explorationIcons, pointIconName } from '@/games/category-icons'
import { HeroPathLayer } from '@/games/hero-path-layer'
import { tr as t } from '@/modules/i18n'
import HeroPathPlayer from './hero-path-player.vue'
import '@/assets/hero-path.css'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'

const props = defineProps<{ game: GameId, layer: MapLayer, rows: ProgressRow[], focus?: [number, number], focusOffset?: number, preserveZoom?: boolean, heroPath?: HeroPath, heroPathVisible?: boolean, active: boolean, panelOpen: boolean }>()
const emit = defineEmits<{ select: [id: string], playbackLayer: [layer: MapLayer] }>()
const host = ref<HTMLElement>()
const zoomHost = ref<HTMLElement>()
const tileError = ref(false)
const pointer = ref('')
let map: L.Map | undefined
let tiles: L.TileLayer | undefined
let backdrop: L.ImageOverlay | undefined
let marks: L.MarkerClusterGroup | undefined
let observer: ResizeObserver | undefined
let alive = true
let focusMarker: L.CircleMarker | undefined
let trail: HeroPathLayer | undefined
const compact = useMediaQuery('(max-width: 760px)')
const pointsVisible = ref(true)
const controlsOpen = ref(false)
defineExpose({
  openControls() {
    controlsOpen.value = true
  },
})
const playback = useHeroPathPlayback(() => props.heroPath, () => props.active && !!props.heroPathVisible)
const { progress, playing, direction, speed } = playback

function drawHeroPath() {
  trail?.remove()
  if (!map || !props.heroPathVisible || !props.heroPath)
    return
  trail = new HeroPathLayer(playback.index.value).addTo(map)
  trail.setLayer(props.layer)
  trail.setPosition(playback.position.value)
}

function followPath(force = false) {
  const frame = playback.frame.value
  if (!map || !frame)
    return
  if (frame.layer !== props.layer)
    emit('playbackLayer', frame.layer)
  const at = map.latLngToContainerPoint(worldToMap(frame.at))
  const size = map.getSize()
  const left = compact.value || !props.panelOpen ? 24 : 365
  const right = size.x - 70
  const top = compact.value ? 85 : 90
  const bottom = size.y - (controlsOpen.value ? 100 : 50)
  if (force || at.x < left || at.x > right || at.y < top || at.y > bottom)
    map.panBy([at.x - (left + right) / 2, at.y - (top + bottom) / 2], { animate: false })
}
function play(direction: 1 | -1) {
  playback.play(direction)
  followPath(true)
}
function seek(percent: number) {
  playback.seek(percent)
  followPath(true)
}
function togglePathPoints() {
  pointsVisible.value = !pointsVisible.value
}
function markerSvg(game: GameId, point: CatalogPoint, status: PointStatus) {
  const color = status === 'complete' ? '#a89e84' : '#d8bd7f'
  const { body } = explorationIcons.icons[pointIconName(game, point)]
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
    const marker = L.marker(worldToMap(row.point.at), { title: row.point.name, icon: L.divIcon({ className: `atlas-marker ${row.status}`, html: markerSvg(props.game, row.point, row.status), iconSize: [24, 28], iconAnchor: [12, 14], tooltipAnchor: [0, -15] }) })
    const label = document.createElement('span')
    label.textContent = row.point.name
    marker.bindTooltip(label, { direction: 'top' }).on('click', (event) => {
      L.DomEvent.stopPropagation(event)
      emit('select', row.point.id)
    })
    markers.push(marker)
  }
  marks.addLayers(markers)
  updatePointVisibility()
}
function updatePointVisibility() {
  if (!map || !marks)
    return
  if (props.heroPathVisible && !pointsVisible.value)
    marks.remove()
  else if (!map.hasLayer(marks))
    marks.addTo(map)
}
function resetView() {
  map?.setView([0, 0], 3.5)
}
function locate() {
  focusMarker?.remove()
  if (!map || !props.focus)
    return
  map.setView(worldToMap(props.focus), props.preserveZoom ? map.getZoom() : Math.max(map.getZoom(), 6))
  if (props.focusOffset)
    map.panBy([0, props.focusOffset], { animate: false })
  focusMarker = L.circleMarker(worldToMap(props.focus), { radius: 15, color: '#e2cb8e', fillOpacity: 0, weight: 2, interactive: false }).addTo(map)
}
watch(() => [props.game, props.layer], base)
watch(() => props.rows, markers)
watch(() => [props.heroPath, props.heroPathVisible], () => {
  if (!props.heroPathVisible)
    controlsOpen.value = false
  drawHeroPath()
  updatePointVisibility()
})
watch(() => props.layer, layer => trail?.setLayer(layer))
watch(pointsVisible, updatePointVisibility)
watch(playback.position, (position) => {
  trail?.setPosition(position)
  if (props.active && props.heroPathVisible)
    followPath()
})
watch(playback.warp, warp => trail?.setWarp(warp))
watch(() => [props.focus, props.focusOffset], () => nextTick(locate), { flush: 'post' })
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
  const pathPane = map.createPane('hero-path')
  pathPane.style.zIndex = '350'
  pathPane.style.pointerEvents = 'none'
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
  drawHeroPath()
  locate()
  observer = new ResizeObserver(() => map?.invalidateSize())
  observer.observe(host.value)
})
onBeforeUnmount(() => {
  alive = false
  observer?.disconnect()
  map?.remove()
})
</script>

<template>
  <div class="map-shell" :class="{ 'has-path-controls': controlsOpen && heroPathVisible && active, 'path-panel-open': panelOpen }">
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
    <HeroPathPlayer
      v-if="controlsOpen && heroPathVisible && heroPath?.segments.length && active"
      :progress="progress" :playing="playing" :direction="direction" :speed="speed" :points-visible="pointsVisible"
      @play="play" @pause="playback.pause" @seek="seek" @speed="speed = (speed + 1) % 3" @points="togglePathPoints" @close="controlsOpen = false"
    />
  </div>
</template>
