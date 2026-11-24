export type GameId = 'botw' | 'totk'
export type GameMode = 'normal' | 'master' | 'unknown'
export type PointStatus = 'complete' | 'incomplete' | 'unknown'
export type MapLayer = 'surface' | 'sky' | 'depths'

export interface GameSnapshot {
  game: GameId
  filename: string
  fingerprint: string
  importedAt: string
  size: number
  progress: { id: string, label: string, done: number, total: number }[]
  milestones: { label: string, complete: boolean }[]
  scalars: Record<string, number>
  guids: string[]
}

export interface CatalogPoint {
  id: string
  category: string
  name: string
  aliases?: string[]
  layer?: MapLayer
  at?: [number, number]
  key?: string | number
  values?: string[]
  found?: string
  detail?: string
  region?: string
  regionLabel?: string
  interior?: boolean
  relatedChestId?: string
  parentId?: string
  rule?: 'positive' | 'boolean' | 'guid' | 'enum' | 'manual'
}

export interface PointAnnotation {
  profileId: string
  pointId: string
  status?: PointStatus
  ignored: boolean
  note: string
  updatedAt: string
}

export function collectionSnapshot(snapshot: GameSnapshot): GameSnapshot {
  const { game, filename, fingerprint, importedAt, size, progress, milestones, scalars, guids } = snapshot
  return { game, filename, fingerprint, importedAt, size, progress, milestones, scalars, guids }
}
