export type GameId = 'botw' | 'totk'
export type GameMode = 'normal' | 'master'
export type PointStatus = 'complete' | 'incomplete' | 'unknown'
export type MapLayer = 'surface' | 'sky' | 'depths'

export interface InventoryItem {
  slot: number
  id: string
  category: string
  quantity: number
  durability?: number
  modifier?: number
  modifierValue?: number
  fuseId?: string
}

export interface GameSnapshot {
  game: GameId
  filename: string
  fingerprint: string
  importedAt: string
  size: number
  rupees: number
  mon: number
  hearts: number
  stamina: number
  energy?: number
  progress: { id: string, label: string, done: number, total: number }[]
  milestones: { label: string, complete: boolean }[]
  items: InventoryItem[]
  horses: { name: string, actor: string, mane: string }[]
  scalars: Record<string, number>
  guids: string[]
}

export interface CatalogPoint {
  id: string
  category: string
  name: string
  layer?: MapLayer
  at?: [number, number]
  key?: string | number
  values?: string[]
  found?: string
  detail?: string
  region?: string
  interior?: boolean
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
