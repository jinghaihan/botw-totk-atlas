<script setup lang="ts">
import { tr as t } from '@/modules/i18n'

const props = defineProps<{ progress: number, playing: boolean, direction: 1 | -1, speed: number, pointsVisible: boolean }>()
const emit = defineEmits<{ play: [direction: 1 | -1], pause: [], seek: [percent: number], speed: [], points: [], close: [] }>()
const speeds = ['path.slow', 'path.medium', 'path.fast'] as const
function toggle() {
  if (props.playing)
    emit('pause')
  else emit('play', props.direction)
}
</script>

<template>
  <div class="hero-path-player" role="group" :aria-label="t('map.hero-path')" :data-playing="playing" :data-direction="direction">
    <div class="hero-path-directions">
      <button class="icon-button" :class="{ selected: playing && direction === -1 }" :aria-label="t('path.rewind')" :title="t('path.rewind')" :aria-pressed="playing && direction === -1" @click="emit('play', -1)">
        <span class="i-lucide:rewind" aria-hidden="true" />
      </button>
      <button class="icon-button hero-path-play" :aria-label="t(playing ? 'path.pause' : 'path.play')" :title="t(playing ? 'path.pause' : 'path.play')" @click="toggle">
        <span :class="playing ? 'i-lucide:pause' : 'i-lucide:play'" aria-hidden="true" />
      </button>
      <button class="icon-button" :class="{ selected: playing && direction === 1 }" :aria-label="t('path.forward')" :title="t('path.forward')" :aria-pressed="playing && direction === 1" @click="emit('play', 1)">
        <span class="i-lucide:fast-forward" aria-hidden="true" />
      </button>
    </div>
    <div class="hero-path-timeline">
      <input
        class="hero-path-range" type="range" min="0" max="100" step="0.01" :value="progress"
        :style="{ '--path-progress': `${progress}%` }"
        :aria-label="t('path.timeline')" :aria-valuetext="`${Math.round(progress)}%`"
        @pointerdown="emit('pause')" @keydown.stop
        @input="emit('seek', Number(($event.target as HTMLInputElement).value))"
      >
      <output class="sr-only">{{ Math.round(progress) }}%</output>
    </div>
    <button class="hero-path-speed" :aria-label="t('path.speed', { speed: t(speeds[speed]) })" :title="t('path.speed', { speed: t(speeds[speed]) })" @click="emit('speed')">
      <span class="hero-path-speed-arrows" aria-hidden="true"><span v-for="n in 3" :key="n" class="i-lucide:chevron-right" :class="{ active: n <= speed + 1 }" /></span>
    </button>
    <div class="hero-path-display">
      <button class="icon-button" :aria-label="t(pointsVisible ? 'path.hide-points' : 'path.show-points')" :title="t(pointsVisible ? 'path.hide-points' : 'path.show-points')" :aria-pressed="!pointsVisible" @click="emit('points')">
        <span :class="pointsVisible ? 'i-lucide:map-pin' : 'i-lucide:map-pin-off'" aria-hidden="true" />
      </button>
      <button class="icon-button" :aria-label="t('path.hide-controls')" :title="t('path.hide-controls')" @click="emit('close')">
        <span class="i-lucide:chevron-down" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
