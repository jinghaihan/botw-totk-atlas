<script setup lang="ts">
import type { ImportRecord, SaveProfile } from '@/storage/profiles'
import { listImports } from '@/storage/profiles'

const props = defineProps<{ profile: SaveProfile }>()
const records = shallowRef<ImportRecord[]>([])
const error = ref('')
watch(() => props.profile, async (profile) => {
  error.value = ''
  try {
    const result = await listImports(profile.id)
    if (profile.id === props.profile.id)
      records.value = result.sort((a, b) => b.importedAt.localeCompare(a.importedAt))
  }
  catch {
    error.value = '无法读取导入历史。'
  }
}, { immediate: true })
</script>

<template>
  <div>
    <div class="section-heading">
      <h2>冒险的变化</h2><span>仅比较目录中能够读取的存档标记</span>
    </div><p v-if="error" role="alert">
      {{ error }}
    </p><p v-if="!records.length" class="coverage-note">
      此 Profile 尚无导入历史。下次更新存档时会记录变化。
    </p><article v-for="record in records" :key="record.id" class="history-card">
      <div class="card-heading">
        <strong>{{ record.initial ? '首次导入' : '更新存档' }} · {{ record.filename }}</strong><time>{{ new Date(record.importedAt).toLocaleString('zh-CN', { hour12: false }) }}</time>
      </div><p v-if="record.initial">
        从这里开始记录你的旅程。
      </p><template v-else>
        <p>新增完成 {{ record.changes.length }} 项 · 进度回退 {{ record.regressions?.length ?? 0 }} 项</p><details v-if="record.changes.length">
          <summary>查看新增完成项</summary><ul>
            <li v-for="change in record.changes" :key="change.id">
              {{ change.name }}
            </li>
          </ul>
        </details><details v-if="record.regressions?.length">
          <summary>查看回退项（可能导入了较早的存档）</summary><ul>
            <li v-for="change in record.regressions" :key="change.id">
              {{ change.name }}
            </li>
          </ul>
        </details>
      </template><code>{{ record.fingerprint.slice(0, 16) }}</code>
    </article>
  </div>
</template>
