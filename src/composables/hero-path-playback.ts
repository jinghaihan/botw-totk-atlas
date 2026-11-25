import type { HeroPathWarpAnimation } from '@/domain/hero-path-playback'
import type { HeroPath } from '@/games/hero-path'
import { useEventListener, useRafFn } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'
import { advanceHeroPath, crossedHeroPathDeath, crossedHeroPathWarp, heroPathFrame, indexHeroPath } from '@/domain/hero-path-playback'

export function useHeroPathPlayback(path: () => HeroPath | undefined, active: () => boolean) {
  const index = computed(() => indexHeroPath(path()))
  const position = ref(0)
  const playing = ref(false)
  const direction = ref<1 | -1>(1)
  const speed = ref(0)
  const warp = shallowRef<HeroPathWarpAnimation>()
  const rates = [120, 600, 2400]
  const deaths = computed(() => index.value.ranges.filter(range => range.segment.end === 'death').map(range => range.end))
  let deathHold = 0
  const frame = computed(() => heroPathFrame(index.value, position.value))
  const progress = computed(() => index.value.length ? position.value / index.value.length * 100 : 100)
  const pause = () => {
    playing.value = false
    warp.value = undefined
  }
  const clock = useRafFn(({ delta }) => {
    if (warp.value) {
      const current = warp.value
      const progress = Math.min(1, current.progress + Math.min(delta, 80) / 280)
      if (progress < 1) {
        warp.value = { ...current, progress }
      }
      else if (current.phase === 'out') {
        position.value = current.to
        warp.value = { ...current, phase: 'in', progress: 0 }
      }
      else {
        warp.value = undefined
        if (position.value === (direction.value === 1 ? index.value.length : 0))
          pause()
      }
      return
    }
    if (deathHold > 0) {
      deathHold -= delta
      return
    }
    const next = advanceHeroPath(position.value, index.value.length, delta, rates[speed.value], direction.value)
    const death = crossedHeroPathDeath(deaths.value, position.value, next)
    const jump = crossedHeroPathWarp(index.value, position.value, next)
    if (jump && (death === undefined || Math.abs(jump.from - position.value) < Math.abs(death - position.value))) {
      position.value = jump.from
      warp.value = { ...jump, phase: 'out', progress: 0 }
      return
    }
    position.value = death ?? next
    if (death !== undefined)
      deathHold = 650
    if (position.value === (direction.value === 1 ? index.value.length : 0))
      pause()
  }, { immediate: false })
  watch(playing, value => value ? clock.resume() : clock.pause(), { flush: 'sync' })
  watch(index, (value) => {
    pause()
    position.value = value.length
    direction.value = 1
  }, { immediate: true })
  watch(active, value => !value && pause())
  useEventListener(document, 'visibilitychange', () => {
    if (document.hidden)
      pause()
  })

  function play(nextDirection = direction.value) {
    if (!active() || index.value.length === 0)
      return
    direction.value = nextDirection
    warp.value = undefined
    deathHold = 0
    if (nextDirection === 1 && position.value >= index.value.length)
      position.value = 0
    if (nextDirection === -1 && position.value <= 0)
      position.value = index.value.length
    playing.value = true
  }
  function seek(percent: number) {
    pause()
    if (Number.isFinite(percent))
      position.value = Math.max(0, Math.min(100, percent)) / 100 * index.value.length
  }
  return { index, position, playing, direction, speed, frame, progress, warp, pause, play, seek }
}
