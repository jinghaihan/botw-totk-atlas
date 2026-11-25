import type { GameId, GameMode } from '@/domain/game'
import * as CRC32 from 'crc-32'

export interface SaveCandidate {
  file: File
  path: string
  game: GameId
  mode: GameMode
  savedAt: number
  pathFiles?: File[]
}
export interface FolderSaveGroup {
  id: string
  root: string
  game: GameId
  mode: GameMode
  candidates: SaveCandidate[]
}
export function readBotwCaption(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  if (view.byteLength < 12 || view.getUint32(4, true) !== 0xFFFFFFFF)
    return { mode: 'unknown' as GameMode }
  const values = new Map<number, number>()
  for (let at = 12; at + 8 <= view.byteLength; at += 8) values.set(view.getUint32(at, true), view.getUint32(at + 4, true))
  const flag = (key: string) => values.get(CRC32.str(key) >>> 0)
  const hard = flag('AoC_HardMode_Enabled')
  const seconds = (flag('LastSaveTime_Upper') ?? 0) * 0x100000000 + (flag('LastSaveTime_Lower') ?? 0)
  const savedAt = seconds >= 946684800 && seconds < 4133980800 ? seconds * 1000 : undefined
  return { mode: (hard === 1 ? 'master' : hard === 0 ? 'normal' : 'unknown') as GameMode, savedAt }
}

export async function inspectSaveFolder(files: File[]): Promise<FolderSaveGroup[]> {
  const path = (file: File) => file.webkitRelativePath || file.name
  const byPath = new Map(files.map(file => [path(file), file]))
  const candidates = await Promise.all(files.filter(file => ['game_data.sav', 'progress.sav'].includes(file.name)).map(async (file): Promise<SaveCandidate> => {
    const fullPath = path(file)
    if (file.name === 'progress.sav')
      return { file, path: fullPath, game: 'totk', mode: 'normal', savedAt: file.lastModified }
    const caption = byPath.get(fullPath.replace(/game_data\.sav$/, 'caption.sav'))
    const metadata = caption ? readBotwCaption(await caption.arrayBuffer()) : { mode: 'unknown' as GameMode, savedAt: undefined }
    return { file, path: fullPath, game: 'botw', mode: metadata.mode, savedAt: metadata.savedAt ?? file.lastModified }
  }))
  const groups = new Map<string, FolderSaveGroup>()
  for (const candidate of candidates) {
    const parent = candidate.path.split('/').slice(0, -1)
    if (/^(?:\d+|slot_\d+)$/.test(parent.at(-1) ?? ''))
      parent.pop()
    const root = parent.join('/')
    candidate.pathFiles = candidate.game === 'totk'
      ? [byPath.get(candidate.path.replace(/progress\.sav$/, 'footprint.sav'))].filter((file): file is File => !!file)
      : candidate.mode === 'unknown'
        ? []
        : files.filter(file =>
            path(file).startsWith(`${root ? `${root}/` : ''}tracker/`)
            && (candidate.mode === 'master' ? /^trackblock_hard\d{2}\.sav$/ : /^trackblock\d{2}\.sav$/).test(file.name),
          )
    const id = `${root}:${candidate.game}:${candidate.mode}`
    if (!groups.has(id))
      groups.set(id, { id, root, game: candidate.game, mode: candidate.mode, candidates: [] })
    groups.get(id)!.candidates.push(candidate)
  }
  return [...groups.values()].map(group => ({ ...group, candidates: group.candidates.sort((a, b) => b.savedAt - a.savedAt || a.path.localeCompare(b.path)) }))
}
