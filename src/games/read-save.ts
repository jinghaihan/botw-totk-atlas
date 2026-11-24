import type { GameSnapshot } from '@/domain/game'
import { AppError } from '@/domain/errors'

export async function readSave(buffer: ArrayBuffer, filename: string): Promise<GameSnapshot> {
  if (buffer.byteLength > 8_000_000)
    throw new AppError('error.save-too-large')
  if (buffer.byteLength < 12)
    throw new AppError('error.save-incomplete')
  const view = new DataView(buffer)
  if (view.getUint32(4, true) === 0xFFFFFFFF)
    return (await import('./botw/reader')).readBotwSave(buffer, filename)
  if (view.getUint32(0, true) === 0x01020304)
    return (await import('./totk/reader')).readTotkSave(buffer, filename)
  throw new AppError('error.save-unrecognized')
}
