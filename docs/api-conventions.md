# API conventions

## tRPC structure
- One router per module in `packages/api/src/routers/{module}.ts`, merged into
  `appRouter`. Export `AppRouter` type for the frontend.
- Routers are **thin**: parse input (Zod) → call the module service → return. No business
  logic in routers.
- Procedures: `publicProcedure` (rare), `protectedProcedure` (requires a session).

## Context
`createContext` builds `{ db, session, user }` from the request. `protectedProcedure`
throws `UNAUTHORIZED` if there's no valid session.

```ts
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user! } });
});
```

## Validation
- Every input has a Zod schema. Share schemas between client and server where useful
  (e.g. in `packages/core` or co-located and re-exported).
- Validate at the boundary; services can assume inputs are well-formed.

## Errors
- Throw `TRPCError` with a proper `code` (`NOT_FOUND`, `FORBIDDEN`, `BAD_REQUEST`,
  `CONFLICT`). Never leak stack traces to the client.
- Domain errors (e.g. "transaction already posted") map to `CONFLICT` with a stable
  `message` the UI can show.

## Pagination & lists
- List endpoints accept `{ cursor?, limit? }` and return `{ items, nextCursor }`.
  Default `limit` 50, max 100. Cursor = last item id + sort key.

## Transactions (DB)
- Any operation that writes business data **and** an `AuditLog` (all finance/approval
  mutations) runs in a single `prisma.$transaction`.

## Auth context source
- Session id comes from a secure, http-only cookie. Cloudflare Access may also gate the
  perimeter, but the app still enforces its own sessions — don't rely on the edge alone.
