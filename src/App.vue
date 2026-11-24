<script setup lang="ts">
import type { SaveProfile } from '@/storage/profiles'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import AtlasSelect from '@/components/AtlasSelect.vue'
import ImportDialog from '@/components/ImportDialog.vue'
import ImportHistory from '@/components/ImportHistory.vue'
import ProfileManager from '@/components/ProfileManager.vue'
import SaveContents from '@/components/SaveContents.vue'
import { loadCatalog } from '@/games/catalog'
import { readSave } from '@/games/read-save'
import { listProfiles, saveProfile } from '@/storage/profiles'
import './assets/atlas.css'

const ExplorerPanel = defineAsyncComponent(() => import('@/components/ExplorerPanel.vue'))
useHead({ title: '旷野图志 · Wilds Atlas' })
const profiles = shallowRef<SaveProfile[]>([])
const activeId = useLocalStorage('wilds-atlas:active-profile', '')
const current = computed(() => profiles.value.find(p => p.id === activeId.value))
const snapshot = computed(() => current.value?.snapshot)
const options = computed(() => profiles.value.map(p => ({ value: p.id, label: p.name })))
const gameName = computed(() => current.value?.game === 'totk' ? '王国之泪' : current.value?.game === 'botw' ? '旷野之息' : '海拉鲁的冒险')
const error = ref('')
const busy = ref(true)
const importOpen = ref(false)
const managerOpen = ref(false)
const tab = ref('atlas')
const number = (n: number) => n.toLocaleString('zh-CN')
const time = (s: string) => new Date(s).toLocaleString('zh-CN', { hour12: false })
async function reload() {
  profiles.value = await listProfiles()
  if (!current.value)
    activeId.value = profiles.value[0]?.id ?? ''
}
async function imported(p: SaveProfile) {
  await reload()
  activeId.value = p.id
}
onMounted(async () => {
  try {
    await reload()
    // Local developer fixture is ignored by Git and never copied to production output.
    if (import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'botw-normal') {
      const response = await fetch('/.local/botw-normal.sav', { cache: 'no-store' })
      if (!response.ok)
        throw new Error('本地预览存档未找到。')
      const parsed = await readSave(await response.arrayBuffer(), 'game_data.sav')
      const existing = profiles.value.find(p => p.name === 'BOTW · 普通模式')
      await imported(await saveProfile(parsed, 'BOTW · 普通模式', existing?.id, 'normal', await loadCatalog('botw')))
    }
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : '档案加载失败，请检查浏览器存储是否可用。'
  }
  finally {
    busy.value = false
  }
})
</script>

<template>
  <div class="atlas-app" :data-game="current?.game ?? 'botw'">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">△</span><span>WILDS ATLAS<small>旷 野 图 志</small></span>
      </div>
      <div class="section-caption">
        你的冒险档案
      </div>
      <AtlasSelect v-if="profiles.length" v-model="activeId" label="切换存档 Profile" :options="options" />
      <button class="new-profile" @click="importOpen = true">
        ＋ 导入新的存档
      </button>
      <button class="new-profile" @click="managerOpen = true">
        <span class="i-lucide:settings-2" /> 管理与备份
      </button>
      <div class="side-rule" /><div class="section-caption">
        {{ current?.game === 'totk' ? 'TEARS OF THE KINGDOM' : 'BREATH OF THE WILD' }}
      </div>
      <button class="side-entry" @click="tab = 'atlas'">
        <span class="i-lucide:compass" /> 海拉鲁图志 <span class="live-dot" />
      </button>
      <p class="sidebar-note">
        寻回走过的足迹，<br>标记下一段旅程。
      </p>
      <div class="sidebar-bottom">
        <span class="i-lucide:hard-drive" /> 仅在此设备保存
      </div>
    </aside>
    <main class="workspace">
      <header class="topbar">
        <div><span class="eyebrow">THE LEGEND OF ZELDA</span><span class="game-name">{{ gameName }}</span></div><div class="top-actions">
          <button class="button secondary mobile-manage" aria-label="管理与备份" @click="managerOpen = true">
            <span class="i-lucide:settings-2" />
          </button><button class="button primary" @click="importOpen = true">
            <span class="i-lucide:upload" /> 导入存档
          </button>
        </div>
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
              {{ snapshot ? '重新看见，每一步走过的海拉鲁。' : '导入你的冒险，找回下一处值得出发的地方。' }}
            </p>
          </div><span class="status-pill"><span class="live-dot" /> {{ busy ? '正在读取…' : current ? current.mode === 'master' ? '大师模式' : '普通模式' : '等待导入' }}</span>
        </section>
        <template v-if="snapshot && current">
          <div class="save-meta">
            <span class="i-lucide:file-check-2" /><span>{{ snapshot.filename }} · {{ number(snapshot.size) }} bytes</span><span>/</span><span>{{ time(snapshot.importedAt) }}</span><code :title="snapshot.fingerprint">SHA-256 {{ snapshot.fingerprint.slice(0, 12) }}</code>
          </div>
          <section class="vitals" aria-label="角色状态">
            <div><span class="vital-icon hearts i-lucide:heart" /><span><small>生命上限</small><strong>{{ snapshot.hearts }} <em>颗心</em></strong></span></div><div><span class="vital-icon stamina i-lucide:circle-gauge" /><span><small>精力上限</small><strong>{{ snapshot.stamina / 1000 }} <em>圈</em></strong></span></div><div><span class="vital-icon rupees i-lucide:gem" /><span><small>卢比</small><strong>{{ number(snapshot.rupees) }}</strong></span></div><div><span class="vital-icon mon" :class="current.game === 'totk' ? 'i-lucide:battery-full' : 'i-lucide:moon'" /><span><small>{{ current.game === 'totk' ? '电池上限' : '怪币' }}</small><strong>{{ current.game === 'totk' ? `${(snapshot.energy ?? 0) / 3000} 格` : number(snapshot.mon) }}</strong></span></div>
          </section>
          <TabsRoot v-model="tab">
            <TabsList class="tab-list" aria-label="存档内容">
              <TabsTrigger value="atlas">
                地图与清单
              </TabsTrigger><TabsTrigger value="progress">
                收集总览
              </TabsTrigger><TabsTrigger value="inventory">
                背包
              </TabsTrigger><TabsTrigger value="horses">
                马厩
              </TabsTrigger><TabsTrigger value="history">
                导入历史
              </TabsTrigger>
            </TabsList>
            <TabsContent value="atlas">
              <ExplorerPanel :key="current.id" :profile="current" />
            </TabsContent>
            <SaveContents :snapshot="snapshot" />
            <TabsContent value="history">
              <ImportHistory :profile="current" />
            </TabsContent>
          </TabsRoot>
        </template>
        <section v-else-if="!busy" class="empty-state">
          <span class="i-lucide:compass" /><h2>海拉鲁，还有地方等你发现</h2><p>支持旷野之息与王国之泪。为每段冒险创建独立档案。</p><button class="button primary" @click="importOpen = true">
            导入我的存档
          </button><div class="onboarding-steps">
            <span>01 选择存档</span><span>02 预览进度</span><span>03 规划下一站</span>
          </div>
        </section>
        <footer class="page-footer">
          <span>WILDS ATLAS ◇ 旷野图志</span><span>存档只读 · 档案仅存于当前浏览器</span>
        </footer>
      </div>
    </main>
    <ImportDialog v-model:open="importOpen" :profiles="profiles" @imported="imported" />
    <ProfileManager v-model:open="managerOpen" :profiles="profiles" @changed="reload" @restored="activeId = $event" />
  </div>
</template>
