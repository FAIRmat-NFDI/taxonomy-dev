export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'PARSE_ERROR'
  | 'CONFLICT'
  | 'NOT_IMPLEMENTED'
  | 'NETWORK'
  | 'UNKNOWN';

/** One error type for the whole app; the api layer converts HTTP/library errors into it. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
