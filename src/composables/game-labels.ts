import type { MaybeRefOrGetter } from 'vue'
import type { CatalogPoint, GameId } from '@/domain/game'
import { z } from 'zod'
import { readJsonResource } from '@/games/data-resource'
import { currentLocale } from '@/modules/i18n'

const schema = z.object({ ids: z.record(z.string(), z.string()), english: z.record(z.string(), z.string()) })
type Labels = z.infer<typeof schema>
const cache = new Map<string, Promise<Labels>>()
export function loadGameLabels(game: GameId, locale: string) {
  // The current game-text source has no Korean records; use its English names.
  const key = `${game}-${locale === 'ko-KR' ? 'en-US' : locale}`
  if (!cache.has(key)) {
    const request = readJsonResource(`labels/${key}.json`, 'Game labels unavailable').then(data => schema.parse(data)).catch((error) => {
      cache.delete(key)
      throw error
    })
    cache.set(key, request)
  }
  return cache.get(key)!
}
export function useGameLabels(game: MaybeRefOrGetter<GameId>) {
  const labels = shallowRef<Labels>({ ids: {}, english: {} })
  const unavailable = ref(false)
  let generation = 0
  watch(() => [toValue(game), currentLocale.value] as const, async ([gameId, locale]) => {
    const revision = ++generation
    labels.value = { ids: {}, english: {} }
    unavailable.value = false
    try {
      const data = await loadGameLabels(gameId, locale)
      if (revision === generation)
        labels.value = data
    }
    catch {
      if (revision === generation)
        unavailable.value = true
    }
  }, { immediate: true })
  const name = (id: string, fallback = id) => labels.value.ids[id] ?? labels.value.english[fallback] ?? fallback
  const text = (fallback: string) => labels.value.english[fallback] ?? fallback
  function localize(point: CatalogPoint): CatalogPoint {
    const id = point.id.split(':').slice(1).join(':')
    return { ...point, name: name(id, point.name), aliases: [point.name], regionLabel: point.region ? text(point.region) : undefined, detail: point.detail ? text(point.detail) : undefined }
  }
  return { name, text, localize, unavailable }
}
