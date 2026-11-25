import type { CatalogPoint, GameSnapshot, PointAnnotation, PointStatus } from './game'
import type { ProfileView } from '@/storage/profiles'
import { createProgressReader } from './completion'

export interface ProgressRow {
  point: CatalogPoint
  automatic?: PointStatus
  status: PointStatus
  annotation?: PointAnnotation
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
    let annotation = annotationsByPoint.get(point.id)
    for (const id of point.alternateIds ?? []) {
      const alternate = annotationsByPoint.get(id)
      if (alternate && (!annotation || alternate.updatedAt > annotation.updatedAt))
        annotation = alternate
    }
    const status = annotation?.status ?? automatic ?? 'incomplete'
    return { point, automatic, status, annotation, ...(reader && point.category === 'shrine' ? { chests: reader.shrineChests(point, children.get(point.id) ?? []) } : {}) }
  })
}

export function filterRows(rows: ProgressRow[], view: Omit<ProfileView, 'profileId'>) {
  const query = view.search.trim().toLocaleLowerCase()
  return rows.filter((row) => {
    const p = row.point
    if (view.categories !== null && !view.categories.includes(p.category))
      return false
    if (!p.at || p.interior || (p.layer ?? 'surface') !== view.layer)
      return false
    if (query && !`${p.name} ${(p.aliases ?? []).join(' ')} ${p.id} ${p.detail ?? ''} ${p.region ?? ''}`.toLocaleLowerCase().includes(query))
      return false
    if (view.status === 'incomplete' && row.status === 'complete')
      return false
    return true
  })
}
