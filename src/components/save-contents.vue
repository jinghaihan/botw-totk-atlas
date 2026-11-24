<script setup lang="ts">
import type { GameSnapshot } from '@/domain/game'
import { TabsContent } from 'reka-ui'
import { currentLocale, tr as t } from '@/modules/i18n'

defineProps<{ snapshot: GameSnapshot }>()
const number = (n: number) => n.toLocaleString(currentLocale.value)
</script>

<template>
  <TabsContent value="progress">
    <div class="section-heading">
      <h2>{{ t('探索记录') }}</h2>
    </div>
    <section class="progress-grid">
      <article v-for="p in snapshot.progress" :key="p.id" class="progress-card">
        <div class="card-heading">
          <span>{{ t(p.label) }}</span><span class="complete-mark">{{ p.done === p.total ? t('✓ 已齐') : t('未完成') }}</span>
        </div><div class="progress-number">
          {{ number(p.done) }}<span>/ {{ number(p.total) }}</span>
        </div><div class="progress-track">
          <span :style="{ width: `${p.done / p.total * 100}%` }" />
        </div><p>
          {{ p.total - p.done === 0 ? t('已核对项目全部完成') : t('还有 {count} 项待完成', { count: p.total - p.done }) }}
        </p>
      </article>
    </section>
    <div class="section-heading">
      <h2>{{ t('挑战与解锁') }}</h2>
    </div>
    <section class="milestones">
      <div v-for="m in snapshot.milestones" :key="m.label">
        <strong>{{ t(m.label) }}</strong><span class="milestone-state" :data-complete="m.complete">{{ m.label === '大师摩托 Zero' ? (m.complete ? t('已解锁') : t('未解锁')) : (m.complete ? t('已完成') : t('尚未完成')) }}</span>
      </div>
    </section>
  </TabsContent>
</template>
