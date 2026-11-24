import { describe, expect, it } from 'vitest'
import { readBotwSave } from '../src/games/botw/reader'

describe('bOTW save validation', () => {
  it('rejects an empty or truncated file with a readable error', async () => {
    await expect(readBotwSave(new ArrayBuffer(8), 'broken.sav')).rejects.toThrow('error.select-botw-save')
  })

  it('rejects a different save format instead of treating it as an empty BOTW save', async () => {
    const buffer = new ArrayBuffer(200_000)
    new DataView(buffer).setUint32(0, 0x01020304, true)
    await expect(readBotwSave(buffer, 'progress.sav')).rejects.toThrow('error.select-botw-save')
  })

  it('rejects a damaged BOTW table instead of reporting zero percent', async () => {
    const buffer = new ArrayBuffer(200_000)
    new DataView(buffer).setUint32(4, 0xFFFFFFFF, true)
    await expect(readBotwSave(buffer, 'game_data.sav')).rejects.toThrow('error.save-incomplete-progress')
  })
})
