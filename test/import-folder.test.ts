import * as CRC32 from 'crc-32'
import { describe, expect, it } from 'vitest'
import { inspectSaveFolder, readBotwCaption } from '@/games/import-folder'

function caption(hard: number, time = 1700000000) {
  const buffer = new ArrayBuffer(36)
  const view = new DataView(buffer)
  view.setUint32(4, 0xFFFFFFFF, true)
  for (const [index, [name, value]] of [['AoC_HardMode_Enabled', hard], ['LastSaveTime_Lower', time]].entries()) {
    view.setUint32(12 + index * 8, CRC32.str(String(name)) >>> 0, true)
    view.setUint32(16 + index * 8, Number(value), true)
  }
  return buffer
}
function file(path: string, bytes: BlobPart[] = []) {
  const f = new File(bytes, path.split('/').at(-1)!, { lastModified: 1800000000000 })
  Object.defineProperty(f, 'webkitRelativePath', { value: path })
  return f
}
describe('folder save detection', () => {
  it('pairs footprint files with their exact slot and keeps BOTW modes and roots separate', async () => {
    const groups = await inspectSaveFolder([
      file('botw/0/game_data.sav'),
      file('botw/0/caption.sav', [caption(0)]),
      file('botw/7/game_data.sav'),
      file('botw/7/caption.sav', [caption(1)]),
      file('botw/tracker/trackblock00.sav'),
      file('botw/tracker/trackblock_hard00.sav'),
      file('other/tracker/trackblock01.sav'),
      file('totk/slot_00/progress.sav'),
      file('totk/slot_00/footprint.sav'),
      file('totk/slot_01/progress.sav'),
      file('totk/slot_01/footprint.sav'),
    ])
    expect(groups.find(group => group.game === 'botw' && group.mode === 'normal')?.candidates[0]?.pathFiles?.map(file => file.webkitRelativePath)).toEqual(['botw/tracker/trackblock00.sav'])
    expect(groups.find(group => group.mode === 'master')?.candidates[0]?.pathFiles?.map(file => file.webkitRelativePath)).toEqual(['botw/tracker/trackblock_hard00.sav'])
    for (const candidate of groups.find(group => group.game === 'totk')!.candidates)
      expect(candidate.pathFiles?.[0]?.webkitRelativePath).toBe(candidate.path.replace('progress.sav', 'footprint.sav'))
  })
  it('reads Normal and Master Mode from companion caption metadata', () => {
    expect(readBotwCaption(caption(0)).mode).toBe('normal')
    expect(readBotwCaption(caption(1)).mode).toBe('master')
    expect(readBotwCaption(new ArrayBuffer(0)).mode).toBe('unknown')
  })
  it('groups modes separately and orders slots by the in-game save time', async () => {
    const groups = await inspectSaveFolder([
      file('export/botw/0/game_data.sav'),
      file('export/botw/0/caption.sav', [caption(0, 1700000000)]),
      file('export/botw/1/game_data.sav'),
      file('export/botw/1/caption.sav', [caption(0, 1700000100)]),
      file('export/botw/7/game_data.sav'),
      file('export/botw/7/caption.sav', [caption(1)]),
      file('export/totk/slot_00/progress.sav'),
      file('export/botw/option.sav'),
      file('export/botw/1/caption.jpg'),
    ])
    expect(groups).toHaveLength(3)
    expect(groups.find(group => group.mode === 'master')?.candidates[0]?.path).toBe('export/botw/7/game_data.sav')
    expect(groups.find(group => group.game === 'botw' && group.mode === 'normal')?.candidates.map(item => item.path)).toEqual(['export/botw/1/game_data.sav', 'export/botw/0/game_data.sav'])
  })
})
