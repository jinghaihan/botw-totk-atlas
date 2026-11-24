import type { GameSnapshot } from '@/domain/game'

export async function readSave(buffer: ArrayBuffer, filename: string): Promise<GameSnapshot> {
  if (buffer.byteLength > 8_000_000)
    throw new Error('存档文件过大，请选择单个 game_data.sav 或 progress.sav。')
  if (buffer.byteLength < 12)
    throw new Error('存档文件不完整。')
  const view = new DataView(buffer)
  if (view.getUint32(4, true) === 0xFFFFFFFF)
    return (await import('./botw/reader')).readBotwSave(buffer, filename)
  if (view.getUint32(0, true) === 0x01020304)
    return (await import('./totk/reader')).readTotkSave(buffer, filename)
  throw new Error('无法识别存档，请选择 BOTW 的 game_data.sav 或 TOTK 的 progress.sav。')
}
