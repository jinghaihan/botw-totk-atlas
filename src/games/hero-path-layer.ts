import type { MapLayer } from '@/domain/game'
import type { HeroPathIndex, HeroPathWarpAnimation } from '@/domain/hero-path-playback'
import * as L from 'leaflet'
import { heroPathFrame } from '@/domain/hero-path-playback'

interface ProjectedSegment {
  start: number
  end: number
  death: boolean
  points: { x: number, y: number, index: number }[]
}

// Project once per map movement, rather than rebuilding Leaflet polylines for
// hundreds of thousands of samples on every animation frame.
export class HeroPathLayer extends L.Layer {
  private canvas = L.DomUtil.create('canvas', 'hero-path-canvas')
  private map?: L.Map
  private projected: ProjectedSegment[] = []
  private position = 0
  private origin = L.point(0, 0)
  private scale = 1
  private layer: MapLayer = 'surface'
  private warp?: HeroPathWarpAnimation

  constructor(private index: HeroPathIndex) {
    super()
    this.canvas.style.pointerEvents = 'none'
    this.canvas.setAttribute('aria-hidden', 'true')
  }

  onAdd(map: L.Map): this {
    this.map = map
    map.getPane('hero-path')!.append(this.canvas)
    map.on('moveend zoomend resize', this.project, this)
    map.on('zoomstart', this.hide, this)
    this.project()
    return this
  }

  onRemove(map: L.Map): this {
    map.off('moveend zoomend resize', this.project, this)
    map.off('zoomstart', this.hide, this)
    this.canvas.remove()
    this.map = undefined
    return this
  }

  setLayer(layer: MapLayer) {
    if (this.layer === layer)
      return
    this.layer = layer
    this.project()
  }

  setPosition(position: number) {
    this.position = position
    this.draw()
  }

  setWarp(warp?: HeroPathWarpAnimation) {
    this.warp = warp
    if (warp)
      this.canvas.dataset.warpPhase = warp.phase
    else delete this.canvas.dataset.warpPhase
    this.draw()
  }

  private hide() { this.canvas.style.visibility = 'hidden' }

  private project() {
    if (!this.map)
      return
    const size = this.map.getSize()
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = size.x * pixelRatio
    this.canvas.height = size.y * pixelRatio
    this.canvas.style.width = `${size.x}px`
    this.canvas.style.height = `${size.y}px`
    this.canvas.style.visibility = ''
    L.DomUtil.setPosition(this.canvas, this.map.containerPointToLayerPoint([0, 0]))
    this.origin = this.map.latLngToContainerPoint([0, 0])
    this.scale = this.map.getZoomScale(this.map.getZoom(), 0) / 64
    this.projected = []
    for (const range of this.index.ranges) {
      if (range.segment.layer !== this.layer)
        continue
      const points: ProjectedSegment['points'] = []
      for (const [i, at] of range.segment.points.entries()) {
        const point = { x: this.origin.x + at[0] * this.scale, y: this.origin.y + at[1] * this.scale, index: range.start + i }
        const previous = points.at(-1)
        // Keep temporal indices when discarding subpixel geometry. Playback still
        // counts every original sample, including stationary ones.
        if (!previous || i === range.segment.points.length - 1 || Math.hypot(previous.x - point.x, previous.y - point.y) >= 0.8)
          points.push(point)
      }
      this.projected.push({ start: range.start, end: range.end, death: range.segment.end === 'death', points })
    }
    this.canvas.getContext('2d')!.scale(pixelRatio, pixelRatio)
    this.draw()
  }

  private draw() {
    const context = this.canvas.getContext('2d')
    if (!context || !this.map)
      return
    const size = this.map.getSize()
    context.clearRect(0, 0, size.x, size.y)
    const path = new Path2D()
    const deaths: { x: number, y: number }[] = []
    const frame = heroPathFrame(this.index, this.position)
    for (const segment of this.projected) {
      if (segment.start > this.position)
        break
      let started = false
      for (const point of segment.points) {
        if (point.index > this.position)
          break
        if (started)
          path.lineTo(point.x, point.y)
        else path.moveTo(point.x, point.y)
        started = true
      }
      if (segment.end > this.position && frame?.layer === this.layer)
        path.lineTo(this.origin.x + frame.at[0] * this.scale, this.origin.y + frame.at[1] * this.scale)
      if (segment.death && segment.end <= this.position)
        deaths.push(segment.points.at(-1)!)
    }
    context.lineJoin = 'round'
    context.lineCap = 'round'
    context.strokeStyle = '#153d2b'
    context.lineWidth = 4.5
    context.stroke(path)
    context.strokeStyle = '#71efa0'
    context.lineWidth = 2.5
    context.stroke(path)
    for (const point of deaths)
      this.death(context, point.x, point.y)
    if (frame?.layer !== this.layer)
      return
    const x = this.origin.x + frame.at[0] * this.scale
    const y = this.origin.y + frame.at[1] * this.scale
    if (frame.death) {
      this.death(context, x, y, 8)
      return
    }
    context.save()
    context.translate(x, y)
    if (this.warp) {
      const { phase, progress } = this.warp
      const visible = phase === 'out' ? 1 - progress : progress
      context.save()
      context.globalAlpha = Math.sin(progress * Math.PI)
      context.strokeStyle = '#c7ffde'
      context.lineWidth = 1.5
      context.beginPath()
      context.arc(0, 0, 7 + (phase === 'out' ? progress : 1 - progress) * 20, 0, Math.PI * 2)
      context.stroke()
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4
        const radius = 5 + (1 - visible) * 17
        context.beginPath()
        context.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 1.5, 0, Math.PI * 2)
        context.fillStyle = '#b5ffd0'
        context.fill()
      }
      context.restore()
      context.globalAlpha = visible
      context.scale(Math.max(0.01, visible), Math.max(0.01, visible))
    }
    context.rotate(frame.angle)
    context.shadowColor = '#71efa0'
    context.shadowBlur = 10
    context.beginPath()
    context.moveTo(0, -10)
    context.lineTo(7, 8)
    context.lineTo(0, 4)
    context.lineTo(-7, 8)
    context.closePath()
    context.fillStyle = '#d9ffe2'
    context.strokeStyle = '#245b3c'
    context.lineWidth = 2
    context.fill()
    context.stroke()
    context.restore()
  }

  private death(context: CanvasRenderingContext2D, x: number, y: number, radius = 5) {
    context.save()
    context.beginPath()
    context.moveTo(x - radius, y - radius)
    context.lineTo(x + radius, y + radius)
    context.moveTo(x + radius, y - radius)
    context.lineTo(x - radius, y + radius)
    context.strokeStyle = '#202323'
    context.lineWidth = 5
    context.stroke()
    context.strokeStyle = '#f18477'
    context.lineWidth = 2.5
    context.stroke()
    context.restore()
  }
}
