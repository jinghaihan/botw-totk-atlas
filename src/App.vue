<script setup lang="ts">
import type { SaveProfile } from '@/storage/profiles'
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, SelectContent, SelectItem, SelectItemIndicator, SelectItemText, SelectPortal, SelectRoot, SelectTrigger, SelectValue, SelectViewport, TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { categoryNames, equipmentNames } from '@/games/botw/labels'
import { readBotwSave } from '@/games/botw/reader'
import { listProfiles, saveProfile } from '@/storage/profiles'
import './assets/atlas.css'

useHead({ title: '存档总览 · 旷野图志' })
const profiles = shallowRef<SaveProfile[]>([])
const activeId = useLocalStorage('wilds-atlas:active-profile', '')
const current = computed(() => profiles.value.find(p => p.id === activeId.value))
const snapshot = computed(() => current.value?.snapshot)
const error = ref('')
const busy = ref(true)
const dialog = ref(false)
const profileName = ref('BOTW · 普通模式')
const file = shallowRef<File>()
const search = ref('')
const category = ref('weapons')
const shownItems = computed(() => (snapshot.value?.items ?? []).filter(item => item.category === category.value && `${equipmentNames[item.id] ?? ''} ${item.id}`.toLowerCase().includes(search.value.toLowerCase())))
const categories = computed(() => Object.entries(categoryNames).map(([id, label]) => ({ id, label, count: snapshot.value?.items.filter(i => i.category === id).length ?? 0 })))
const number = (n: number) => n.toLocaleString('zh-CN')
const time = (s: string) => new Date(s).toLocaleString('zh-CN', { hour12: false })
const message = (e: unknown) => e instanceof Error ? e.message : '读取失败，请重新选择存档。'

async function acceptSave(buffer: ArrayBuffer, filename: string, existingId?: string) {
  const parsed = await readBotwSave(buffer, filename)
  const profile = await saveProfile(parsed, profileName.value, existingId)
  profiles.value = await listProfiles()
  activeId.value = profile.id
}

async function importFile() {
  if (!file.value)
    return
  busy.value = true
  error.value = ''
  try {
    await acceptSave(await file.value.arrayBuffer(), file.value.name)
    dialog.value = false
    file.value = undefined
  }
  catch (e) {
    error.value = message(e)
  }
  finally {
    busy.value = false
  }
}

onMounted(async () => {
  try {
    profiles.value = await listProfiles()
    if (!current.value && profiles.value[0])
      activeId.value = profiles.value[0].id
    if (import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'botw-normal') {
      const response = await fetch('/.local/botw-normal.sav', { cache: 'no-store' })
      if (!response.ok)
        throw new Error('本地预览存档未找到。')
      const existing = profiles.value.find(p => p.name === 'BOTW · 普通模式')
      await acceptSave(await response.arrayBuffer(), 'game_data.sav', existing?.id)
    }
  }
  catch (e) {
    error.value = message(e)
  }
  finally {
    busy.value = false
  }
})
</script>

<template>
  <div class="atlas-app">
    <aside class="sidebar">
      <a class="brand" href="/" aria-label="Wilds Atlas 首页"><span class="brand-mark" aria-hidden="true">△</span><span>WILDS ATLAS<small>旷 野 图 志</small></span></a>
      <div class="section-caption">
        你的冒险档案
      </div>
      <SelectRoot v-model="activeId">
        <SelectTrigger class="profile-trigger" aria-label="切换存档 Profile">
          <span class="i-lucide:folder-open" /><SelectValue placeholder="选择存档" /><span class="i-lucide:chevrons-up-down" />
        </SelectTrigger>
        <SelectPortal>
          <SelectContent class="select-menu" position="popper" :side-offset="8">
            <SelectViewport>
              <SelectItem v-for="p in profiles" :key="p.id" :value="p.id" class="select-item">
                <SelectItemText>{{ p.name }}</SelectItemText><SelectItemIndicator>✓</SelectItemIndicator>
              </SelectItem>
            </SelectViewport>
          </SelectContent>
        </SelectPortal>
      </SelectRoot>
      <button class="new-profile" @click="dialog = true">
        ＋ 导入新的存档
      </button>
      <div class="side-rule" /><div class="section-caption">
        BREATH OF THE WILD
      </div>
      <div class="side-entry">
        <span class="i-lucide:compass" /> 存档总览 <span class="live-dot" />
      </div>
      <p class="sidebar-note">
        从存档读取你的冒险记录。<br>所有档案保存在当前浏览器。
      </p>
      <div class="sidebar-bottom">
        <span class="i-lucide:hard-drive" /> 仅在此设备保存
      </div>
    </aside>
    <main class="workspace">
      <header class="topbar">
        <div><span class="eyebrow">THE LEGEND OF ZELDA</span><span class="game-name">旷野之息</span></div><button class="button primary" @click="dialog = true">
          <span class="i-lucide:upload" /> 导入存档
        </button>
      </header>
      <div class="main-content">
        <div v-if="error" class="error-message" role="alert">
          {{ error }}
        </div>
        <section class="page-intro">
          <div>
            <p class="eyebrow">
              YOUR JOURNEY, REMEMBERED
            </p><h1>{{ current?.name ?? '开启你的旷野图志' }}</h1><p class="intro-copy">
              {{ snapshot ? '重新看见，每一步走过的海拉鲁。' : '导入 game_data.sav，查看真实的收集进度与背包。' }}
            </p>
          </div><span class="status-pill"><span class="live-dot" /> {{ busy ? '正在读取…' : snapshot ? '已读取真实存档' : '等待导入' }}</span>
        </section>
        <template v-if="snapshot">
          <div class="save-meta">
            <span class="i-lucide:file-check-2" /><span>{{ snapshot.filename }} · {{ number(snapshot.size) }} bytes</span><span>/</span><span>{{ time(snapshot.importedAt) }}</span><code :title="snapshot.fingerprint">SHA-256 {{ snapshot.fingerprint.slice(0, 12) }}</code>
          </div>
          <section class="vitals" aria-label="角色状态">
            <div><span class="vital-icon hearts i-lucide:heart" /><span><small>生命上限</small><strong>{{ snapshot.hearts }} <em>颗心</em></strong></span></div>
            <div><span class="vital-icon stamina i-lucide:circle-gauge" /><span><small>精力上限</small><strong>{{ snapshot.stamina / 1000 }} <em>圈</em></strong></span></div>
            <div><span class="vital-icon rupees i-lucide:gem" /><span><small>卢比</small><strong>{{ number(snapshot.rupees) }}</strong></span></div>
            <div><span class="vital-icon mon i-lucide:moon" /><span><small>怪币</small><strong>{{ number(snapshot.mon) }}</strong></span></div>
          </section>
          <TabsRoot default-value="progress">
            <TabsList class="tab-list" aria-label="存档内容">
              <TabsTrigger value="progress">
                探索与收集
              </TabsTrigger><TabsTrigger value="inventory">
                背包与装备 <span>{{ snapshot.items.length }}</span>
              </TabsTrigger><TabsTrigger value="horses">
                马厩 <span>{{ snapshot.horses.length }}</span>
              </TabsTrigger>
            </TabsList>
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
                <span class="i-lucide:info" /> 当前为存档预览：展示已接入的收集记录、装备和马匹。真实地图、野外宝箱逐箱追踪仍在开发中。
              </p>
            </TabsContent>
            <TabsContent value="inventory">
              <div class="inventory-toolbar">
                <SelectRoot v-model="category">
                  <SelectTrigger class="filter-trigger" aria-label="装备分类">
                    <SelectValue /><span class="i-lucide:chevron-down" />
                  </SelectTrigger><SelectPortal>
                    <SelectContent class="select-menu" position="popper" :side-offset="6">
                      <SelectViewport>
                        <SelectItem v-for="c in categories" :key="c.id" :value="c.id" class="select-item">
                          <SelectItemText>{{ c.label }} · {{ c.count }}</SelectItemText><SelectItemIndicator>✓</SelectItemIndicator>
                        </SelectItem>
                      </SelectViewport>
                    </SelectContent>
                  </SelectPortal>
                </SelectRoot><label class="search-box"><span class="i-lucide:search" /><input v-model="search" placeholder="搜索名称或物品编号" aria-label="搜索背包物品"></label><span>{{ shownItems.length }} 件</span>
              </div>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>栏位</th><th>物品</th><th>{{ ['weapons', 'bows', 'shields'].includes(category) ? '当前耐久' : '数量 / 原始数值' }}</th><th>附加值</th><th>效果标记</th></tr></thead><tbody>
                    <tr v-for="item in shownItems" :key="item.slot">
                      <td class="muted">
                        {{ String(item.slot).padStart(2, '0') }}
                      </td><td><strong>{{ equipmentNames[item.id] ?? item.id }}</strong><small v-if="equipmentNames[item.id]">{{ item.id }}</small></td><td>{{ item.modifier !== undefined ? item.quantity / 100 : item.quantity }}</td><td>{{ item.modifierValue ?? '—' }}</td><td><code>{{ item.modifier !== undefined ? `0x${item.modifier.toString(16).toUpperCase()}` : '—' }}</code></td>
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
          </TabsRoot>
        </template>
        <section v-else-if="!busy" class="empty-state">
          <span class="i-lucide:compass" /><h2>这里会记录你的旅程</h2><p>创建独立的 Profile，从存档读取你的探索进度。</p><button class="button primary" @click="dialog = true">
            导入 BOTW 存档
          </button>
        </section>
        <footer class="page-footer">
          <span>WILDS ATLAS ◇ 旷野图志</span><span>存档只读 · 进度保存在此浏览器</span>
        </footer>
      </div>
    </main>
    <DialogRoot v-model:open="dialog">
      <DialogPortal>
        <DialogOverlay class="dialog-overlay" /><DialogContent class="dialog-content">
          <DialogTitle>导入一段冒险</DialogTitle><DialogDescription>读取 BOTW 的 game_data.sav，保存为独立 Profile。原始存档保持只读。</DialogDescription><form @submit.prevent="importFile">
            <label>Profile 名称<input v-model="profileName" required maxlength="80"></label><label>存档文件<input type="file" accept=".sav" required @change="file = ($event.target as HTMLInputElement).files?.[0]"></label><p v-if="error" role="alert" class="error-message">
              {{ error }}
            </p><button class="button primary" type="submit" :disabled="busy || !file">
              {{ busy ? '正在读取…' : '读取并创建 Profile' }}
            </button>
          </form><DialogClose class="dialog-close" aria-label="关闭导入窗口">
            ×
          </DialogClose>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
