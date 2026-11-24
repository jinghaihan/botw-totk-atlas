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
      <h2>{{ t('探索记录') }}</h2><span>{{ t('直接读取存档标记 · 含 DLC') }}</span>
    </div>
    <section class="progress-grid">
      <article v-for="p in snapshot.progress" :key="p.id" class="progress-card">
        <div class="card-heading">
          <span>{{ t(p.label) }}</span><span class="complete-mark">{{ p.done === p.total ? t('✓ 已齐') : t('未完成') }}</span>
        </div><div class="progress-number">
          {{ number(p.done) }}<span>/ {{ number(p.total) }}</span>
        </div><div class="progress-track">
          <span :style="{ width: `${p.done / p.total * 100}%` }" />
        </div><p v-if="p.id === 'shrine-chests'">
          {{ t('神庙通关与领取宝箱分别核对') }}
        </p><p v-else-if="p.id === 'compendium'">
          {{ t('含普通模式未展示的内部登记记录') }}
        </p><p v-else>
          {{ p.total - p.done === 0 ? t('已核对项目全部完成') : t('还有 {count} 项待完成', { count: p.total - p.done }) }}
        </p>
      </article>
    </section>
    <div class="section-heading">
      <h2>{{ t('特别的旅程') }}</h2><span>{{ t('挑战与解锁') }}</span>
    </div>
    <section class="milestones">
      <div v-for="m in snapshot.milestones" :key="m.label">
        <span class="i-lucide:badge-check" /><strong>{{ t(m.label) }}</strong><span>{{ m.complete ? t('已完成 / 已解锁') : t('尚未完成') }}</span>
      </div>
    </section>
    <p class="coverage-note">
      <span class="i-lucide:info" />{{ t('此处为存档中的全局收集记录；地图和清单展示社区目录中能够定位的项目，统计口径可能不同。') }}
    </p>
  </TabsContent>
</template>
