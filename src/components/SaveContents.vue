<script setup lang="ts">
import type { GameSnapshot } from '@/domain/game'
import { TabsContent } from 'reka-ui'
import { useGameLabels } from '@/composables/game-labels'
import { categoryNames, equipmentNames } from '@/games/botw/labels'
import { currentLocale, tr as t } from '@/modules/i18n'
import AtlasSelect from './AtlasSelect.vue'

const props = defineProps<{ snapshot: GameSnapshot }>()
const gameLabels = useGameLabels(() => props.snapshot.game)
const search = ref('')
const category = ref('weapons')
const shownItems = computed(() => props.snapshot.items.filter(item => item.category === category.value && `${gameLabels.name(item.id, equipmentNames[item.id] ?? item.id)} ${item.id}`.toLowerCase().includes(search.value.toLowerCase())))
const categories = computed(() => [...new Set(props.snapshot.items.map(i => i.category))].map(value => ({ value, label: `${t(props.snapshot.game === 'totk' && value === 'materials' ? '材料' : categoryNames[value] ?? (value === 'devices' ? '左纳乌装置' : value === 'food' ? '料理' : value))} · ${props.snapshot.items.filter(i => i.category === value).length}` })))
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
  <TabsContent value="inventory">
    <div class="inventory-toolbar">
      <AtlasSelect v-model="category" :label="t('背包分类')" :options="categories" /><label class="search-box"><span class="i-lucide:search" /><input v-model="search" :placeholder="t('搜索名称或物品编号')" :aria-label="t('搜索背包物品')"></label><span>{{ t('{count} 件', { count: shownItems.length }) }}</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>{{ t('栏位') }}</th><th>{{ t('物品') }}</th><th>{{ ['weapons', 'bows', 'shields'].includes(category) ? t('当前耐久') : t('数量 / 原始数值') }}</th><th>{{ t('附加值') }}</th><th>{{ t('效果标记') }}</th></tr></thead><tbody>
          <tr v-for="item in shownItems" :key="`${item.category}:${item.slot}`">
            <td class="muted">
              {{ String(item.slot).padStart(2, '0') }}
            </td><td><strong>{{ gameLabels.name(item.id, equipmentNames[item.id] ? t(equipmentNames[item.id]!) : item.id) }}</strong><small v-if="gameLabels.name(item.id) !== item.id">{{ item.id }}</small></td><td>{{ item.durability ?? item.quantity }}</td><td>{{ item.modifierValue ?? '—' }}</td><td><code>{{ item.modifier !== undefined ? `0x${item.modifier.toString(16).toUpperCase()}` : '—' }}</code></td>
          </tr>
        </tbody>
      </table>
    </div><p class="coverage-note">
      {{ t('装备数值为存档原值；尚未翻译的物品显示游戏编号，服装栏原始数值不代表件数。') }}
    </p>
  </TabsContent>
  <TabsContent value="horses">
    <div class="section-heading">
      <h2>{{ t('同行的伙伴') }}</h2><span>{{ t('按马厩登记顺序') }}</span>
    </div><div class="horse-grid">
      <article v-for="(horse, i) in snapshot.horses" :key="i" class="horse-card">
        <span class="horse-index">0{{ i + 1 }}</span><span class="i-lucide:heart-handshake horse-symbol" /><h3>{{ horse.name }}</h3><p>{{ horse.actor === 'GameRomHorseEpona' ? t('真正的 Epona') : horse.actor === 'GameRomHorseZelda' ? t('白马') : horse.actor.endsWith('00L') ? t('巨马') : t('登记马匹') }}</p><code>{{ horse.actor }}</code><div class="mane">
          {{ gameLabels.name(horse.mane) }}
        </div>
      </article>
    </div>
  </TabsContent>
</template>
