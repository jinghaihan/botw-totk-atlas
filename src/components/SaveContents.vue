<script setup lang="ts">
import type { GameSnapshot } from '@/domain/game'
import { TabsContent } from 'reka-ui'
import { categoryNames, equipmentNames } from '@/games/botw/labels'
import AtlasSelect from './AtlasSelect.vue'

const props = defineProps<{ snapshot: GameSnapshot }>()
const search = ref('')
const category = ref('weapons')
const shownItems = computed(() => props.snapshot.items.filter(item => item.category === category.value && `${equipmentNames[item.id] ?? ''} ${item.id}`.toLowerCase().includes(search.value.toLowerCase())))
const categories = computed(() => [...new Set(props.snapshot.items.map(i => i.category))].map(value => ({ value, label: `${categoryNames[value] ?? (value === 'devices' ? '左纳乌装置' : value)} · ${props.snapshot.items.filter(i => i.category === value).length}` })))
const number = (n: number) => n.toLocaleString('zh-CN')
</script>

<template>
  <TabsContent value="progress">
    <div class="section-heading">
      <h2>探索记录</h2><span>直接读取存档标记 · 含 DLC</span>
    </div>
    <section class="progress-grid">
      <article v-for="p in snapshot.progress" :key="p.id" class="progress-card">
        <div class="card-heading">
          <span>{{ p.label }}</span><span class="complete-mark">{{ p.done === p.total ? '✓ 已齐' : '未完成' }}</span>
        </div><div class="progress-number">
          {{ number(p.done) }}<span>/ {{ number(p.total) }}</span>
        </div><div class="progress-track">
          <span :style="{ width: `${p.done / p.total * 100}%` }" />
        </div><p v-if="p.id === 'shrine-chests'">
          神庙通关与领取宝箱分别核对
        </p><p v-else-if="p.id === 'compendium'">
          含普通模式未展示的内部登记记录
        </p><p v-else>
          {{ p.total - p.done === 0 ? '已核对项目全部完成' : `还有 ${p.total - p.done} 项待完成` }}
        </p>
      </article>
    </section>
    <div class="section-heading">
      <h2>特别的旅程</h2><span>挑战与解锁</span>
    </div>
    <section class="milestones">
      <div v-for="m in snapshot.milestones" :key="m.label">
        <span class="i-lucide:badge-check" /><strong>{{ m.label }}</strong><span>{{ m.complete ? '已完成 / 已解锁' : '尚未完成' }}</span>
      </div>
    </section>
    <p class="coverage-note">
      <span class="i-lucide:info" /> 此处为存档中的全局收集记录；地图和清单展示社区目录中能够定位的项目，统计口径可能不同。
    </p>
  </TabsContent>
  <TabsContent value="inventory">
    <div class="inventory-toolbar">
      <AtlasSelect v-model="category" label="背包分类" :options="categories" /><label class="search-box"><span class="i-lucide:search" /><input v-model="search" placeholder="搜索名称或物品编号" aria-label="搜索背包物品"></label><span>{{ shownItems.length }} 件</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>栏位</th><th>物品</th><th>{{ ['weapons', 'bows', 'shields'].includes(category) ? '当前耐久' : '数量 / 原始数值' }}</th><th>附加值</th><th>效果标记</th></tr></thead><tbody>
          <tr v-for="item in shownItems" :key="`${item.category}:${item.slot}`">
            <td class="muted">
              {{ String(item.slot).padStart(2, '0') }}
            </td><td><strong>{{ equipmentNames[item.id] ?? item.id }}</strong><small v-if="equipmentNames[item.id]">{{ item.id }}</small></td><td>{{ item.durability ?? item.quantity }}</td><td>{{ item.modifierValue ?? '—' }}</td><td><code>{{ item.modifier !== undefined ? `0x${item.modifier.toString(16).toUpperCase()}` : '—' }}</code></td>
          </tr>
        </tbody>
      </table>
    </div><p class="coverage-note">
      装备数值为存档原值；尚未翻译的物品显示游戏编号，服装栏原始数值不代表件数。
    </p>
  </TabsContent>
  <TabsContent value="horses">
    <div class="section-heading">
      <h2>同行的伙伴</h2><span>按马厩登记顺序</span>
    </div><div class="horse-grid">
      <article v-for="(horse, i) in snapshot.horses" :key="i" class="horse-card">
        <span class="horse-index">0{{ i + 1 }}</span><span class="i-lucide:heart-handshake horse-symbol" /><h3>{{ horse.name }}</h3><p>{{ horse.actor === 'GameRomHorseEpona' ? '真正的 Epona' : horse.actor === 'GameRomHorseZelda' ? '白马' : horse.actor.endsWith('00L') ? '巨马' : '登记马匹' }}</p><code>{{ horse.actor }}</code><div class="mane">
          {{ horse.mane === 'Horse_Link_Mane_04' ? '网状编辫' : horse.mane }}
        </div>
      </article>
    </div>
  </TabsContent>
</template>
