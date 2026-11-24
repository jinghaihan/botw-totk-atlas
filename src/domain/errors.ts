import type { MessageKey } from '@/modules/i18n'

export type ErrorMessageKey = Extract<MessageKey, `error.${string}`>

export class AppError extends Error {
  constructor(readonly key: ErrorMessageKey, readonly values: Record<string, string | number> = {}) {
    super(key)
  }

  static from(cause: unknown, fallback: ErrorMessageKey) {
    return cause instanceof AppError ? cause : new AppError(fallback)
  }
}
