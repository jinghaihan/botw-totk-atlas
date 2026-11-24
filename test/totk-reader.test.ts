import { describe, expect, it } from 'vitest'
import { readSave } from '@/games/read-save'
import { readTotkSave } from '@/games/totk/reader'

describe('tOTK save validation', () => {
  it('rejects a truncated file before attempting to read pointers', async () => {
    await expect(readTotkSave(new ArrayBuffer(4), 'progress.sav')).rejects.toThrow('error.select-totk-save')
  })
  it('rejects a missing metadata boundary instead of reporting an empty collection', async () => {
    const buffer = new ArrayBuffer(100_000)
    new DataView(buffer).setUint32(0, 0x01020304, true)
    await expect(readSave(buffer, 'progress.sav')).rejects.toThrow('error.totk-missing-data-boundary')
  })
  it('rejects an out-of-bounds GUID pointer', async () => {
    const buffer = new ArrayBuffer(100_000)
    const view = new DataView(buffer)
    view.setUint32(0, 0x01020304, true)
    view.setUint32(0x28, 0xA3DB7114, true)
    view.setUint32(0x2C, 0xFFFFFFFF, true)
    await expect(readTotkSave(buffer, 'progress.sav')).rejects.toThrow('error.totk-invalid-data-boundary')
  })
})
