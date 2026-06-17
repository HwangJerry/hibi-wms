export type ErrorCode =
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  override readonly cause?: unknown;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = options?.cause;
  }
}

export function badRequest(message: string, cause?: unknown) {
  return new AppError("BAD_REQUEST", message, { cause });
}

export function forbidden(message: string, cause?: unknown) {
  return new AppError("FORBIDDEN", message, { cause });
}

export function notFound(message: string, cause?: unknown) {
  return new AppError("NOT_FOUND", message, { cause });
}

export function conflict(message: string, cause?: unknown) {
  return new AppError("CONFLICT", message, { cause });
}

export function internalError(message: string, cause?: unknown) {
  return new AppError("INTERNAL", message, { cause });
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
