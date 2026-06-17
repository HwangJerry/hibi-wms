import { describe, expect, it } from "vitest";

import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  internalError,
  isAppError,
  notFound,
} from "./errors.js";

describe("error helpers", () => {
  it("creates a bad request error", () => {
    const cause = new Error("bad");
    const error = badRequest("invalid payload", cause);

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe("invalid payload");
    expect(error.cause).toBe(cause);
  });

  it("creates all shared application errors", () => {
    const forbiddenError = forbidden("forbidden");
    const notFoundError = notFound("missing");
    const conflictError = conflict("duplicate");
    const internalErrorValue = internalError("oops");

    expect(forbiddenError.code).toBe("FORBIDDEN");
    expect(notFoundError.code).toBe("NOT_FOUND");
    expect(conflictError.code).toBe("CONFLICT");
    expect(internalErrorValue.code).toBe("INTERNAL");
  });

  it("detects AppError instances", () => {
    const regularError = new Error("regular");
    const appError = badRequest("invalid");

    expect(isAppError(appError)).toBe(true);
    expect(isAppError(regularError)).toBe(false);
  });
});
