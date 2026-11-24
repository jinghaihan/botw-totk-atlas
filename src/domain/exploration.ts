import type { CatalogPoint, GameSnapshot, PointAnnotation, PointStatus } from './game'
import type { ProfileView } from '@/storage/profiles'
import { createProgressReader } from './completion'

export interface ProgressRow {
  point: CatalogPoint
  automatic?: PointStatus
  status: PointStatus
  annotation?: PointAnnotation
  found: boolean
  chests?: { total: number | null, opened: number | null, complete: boolean | undefined }
}
export function resolveRows(snapshot: GameSnapshot | undefined, points: CatalogPoint[], annotations: PointAnnotation[]): ProgressRow[] {
  const reader = snapshot ? createProgressReader(snapshot) : undefined
  const annotationsByPoint = new Map(annotations.map(a => [a.pointId, a]))
  // Index children once; avoid scanning thousands of chests per shrine and filter update.
  const children = new Map<string, CatalogPoint[]>()
  for (const p of points) {
    if (p.parentId)
      children.set(p.parentId, [...children.get(p.parentId) ?? [], p])
  }
  return points.map((point) => {
    const automatic = reader?.status(point)
    const annotation = annotationsByPoint.get(point.id)
    const status = annotation?.status ?? automatic ?? 'incomplete'
    return { point, automatic, status, annotation, found: reader?.found(point) ?? status === 'complete', ...(reader && point.category === 'shrine' ? { chests: reader.shrineChests(point, children.get(point.id) ?? []) } : {}) }
  })
}

export function filterRows(rows: ProgressRow[], view: Omit<ProfileView, 'profileId'>, spatial = false) {
  const query = view.search.trim().toLocaleLowerCase()
  return rows.filter((row) => {
    const p = row.point
    if (view.categories !== null && !view.categories.includes(p.category))
      return false
    if (spatial && (!p.at || p.interior || (p.layer ?? 'surface') !== view.layer))
      return false
    if (query && !`${p.name} ${(p.aliases ?? []).join(' ')} ${p.id} ${p.detail ?? ''} ${p.region ?? ''}`.toLocaleLowerCase().includes(query))
      return false
    if ((view.status === 'complete' || view.status === 'incomplete') && row.status !== view.status)
      return false
    if (view.status === 'found-unfinished' && (!row.found || row.status !== 'incomplete'))
      return false
    if (view.status === 'shrine-chests' && (p.category !== 'shrine' || row.automatic !== 'complete' || row.chests?.complete !== false))
      return false
    return true
  })
}
