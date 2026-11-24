<script setup lang="ts">
import type { SaveProfile } from '@/storage/profiles'
import { TabsContent } from 'reka-ui'
import { masterCycleName, progressLabels } from '@/domain/game'
import { categoryDisplayOrder, categoryLabel, loadCatalog } from '@/games/catalog'
import { currentLocale, tr as t } from '@/modules/i18n'
import { listAnnotations } from '@/storage/profiles'

const props = defineProps<{ profile: SaveProfile }>()
const manualProgress = shallowRef<{ id: string, label: string, done: number, total: number }[]>([])
const loading = ref(false)
const failed = ref(false)
const progress = computed(() => props.profile.snapshot?.progress ?? manualProgress.value)

onMounted(async () => {
  const { id, game, snapshot } = props.profile
  if (snapshot)
    return
  loading.value = true
  try {
    const [catalog, annotations] = await Promise.all([loadCatalog(game), listAnnotations(id)])
    const completed = new Set(annotations.filter(annotation => annotation.status === 'complete').map(annotation => annotation.pointId))
    const counts = new Map<string, { done: number, total: number }>()
    for (const point of catalog) {
      if (!point.at || point.interior)
        continue
      const count = counts.get(point.category) ?? { done: 0, total: 0 }
      count.total += 1
      count.done += Number(completed.has(point.id))
      counts.set(point.category, count)
    }
    manualProgress.value = categoryDisplayOrder.flatMap((category) => {
      const count = counts.get(category)
      return count ? [{ id: category, label: category, ...count }] : []
    })
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
})
const milestoneName = (label: string) => label === '大师摩托 Zero' ? masterCycleName : label
const number = (n: number) => n.toLocaleString(currentLocale.value)
</script>

<template>
  <TabsContent value="progress">
    <div class="section-heading">
      <h2>{{ t('探索记录') }}</h2>
    </div>
    <p v-if="loading" role="status">
      {{ t('正在读取…') }}
    </p>
    <p v-else-if="failed" role="alert" class="error-message">
      {{ t('无法加载探索记录。') }}
    </p>
    <section v-else class="progress-grid">
      <article v-for="p in progress" :key="p.id" class="progress-card">
        <div class="card-heading">
          <span>{{ t(profile.snapshot ? (Object.hasOwn(progressLabels, p.id) ? progressLabels[p.id] : p.label) : categoryLabel(profile.game, p.id)) }}</span><span class="complete-mark">{{ p.done === p.total ? t('已完成') : t('未完成') }}</span>
        </div><div class="progress-number">
          {{ number(p.done) }}<span>/ {{ number(p.total) }}</span>
        </div><div class="progress-track">
          <span :style="{ width: `${p.done / p.total * 100}%` }" />
        </div><p>
          {{ p.total - p.done === 0 ? t('已核对项目全部完成') : t('还有 {count} 项待完成', { count: p.total - p.done }) }}
        </p>
      </article>
    </section>
    <div v-if="profile.snapshot" class="section-heading">
      <h2>{{ t('挑战与解锁') }}</h2>
    </div>
    <section v-if="profile.snapshot" class="milestones">
      <div v-for="m in profile.snapshot.milestones" :key="m.label">
        <strong>{{ t(milestoneName(m.label)) }}</strong><span class="milestone-state" :data-complete="m.complete">{{ milestoneName(m.label) === masterCycleName ? (m.complete ? t('已解锁') : t('未解锁')) : (m.complete ? t('已完成') : t('尚未完成')) }}</span>
      </div>
    </section>
  </TabsContent>
</template>
