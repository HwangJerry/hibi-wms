# Data model

PostgreSQL via Prisma. One schema in `packages/db`. Snippets below show the *shape* of
the models — fill in indexes, `@@map`, and constraints as you implement.

## Conventions
- Primary keys: `cuid()` strings unless noted.
- Timestamps: `createdAt` / `updatedAt` on every table.
- Soft delete via `deletedAt` where deletion must be reversible (docs, tasks). Financial
  records are **never** hard- or soft-deleted — they are reversed with a new entry.
- Enums in Prisma for fixed sets (statuses, types).

## Shared primitives (`core`)

### User & Session
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  passwordHash String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Session {
  id        String   @id
  userId    String
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id])
}
```

### Reference (polymorphic links)
Any entity can link to any other. `type` identifies the table; `id` the row.
```prisma
model Reference {
  id        String   @id @default(cuid())
  fromType  EntityType
  fromId    String
  toType    EntityType
  toId      String
  relation  String?      // optional label, e.g. "spec", "budget"
  createdAt DateTime @default(now())
  @@unique([fromType, fromId, toType, toId, relation])
  @@index([toType, toId])
}

enum EntityType { TASK APPROVAL TRANSACTION PAGE COMMENT }
```

### AuditLog (append-only)
```prisma
model AuditLog {
  id         String   @id @default(cuid())
  actorId    String
  action     String       // e.g. "transaction.posted", "approval.approved"
  entityType EntityType
  entityId   String
  data       Json         // before/after or payload snapshot
  createdAt  DateTime @default(now())
  @@index([entityType, entityId])
}
```
Writes to AuditLog happen inside the same DB transaction as the action they record.

### Comment & Attachment (attach via Reference)
```prisma
model Comment {
  id        String   @id @default(cuid())
  authorId  String
  body      String
  createdAt DateTime @default(now())
}

model Attachment {
  id        String   @id @default(cuid())
  uploaderId String
  fileName  String
  mimeType  String
  sizeBytes Int
  r2Key     String       // object key in Cloudflare R2
  createdAt DateTime @default(now())
}
```

## Module models (summary — full detail in each module spec)

### Backlog
`Task` ( title, description, status[BACKLOG|TODO|IN_PROGRESS|DONE], priority, assigneeId?,
parentId? for epics, order ). See `modules/backlog.md`.

### Approval
`ApprovalRequest` ( type[FINANCIAL|WORK], title, requesterId, approverId, state, decidedAt? )
plus `ApprovalAction` history. See `modules/approval.md`.

### Finance
`Account`, `Category`, `Transaction` ( amount, currency, status[PENDING|POSTED|REVERSED],
approvalId? ), `Budget`. See `modules/finance.md`.

### Docs
`Space`, `Page` ( spaceId, parentId?, title, yDoc bytes ), `PageVersion`. See
`modules/collab-docs.md`.

## Integrity rules
- A `Transaction` with `status = POSTED` must have an `approvalId` whose request is
  `approved` (enforce in the finance service + a DB check where feasible).
- Deleting a `Space` cascades to its `Page` tree (soft delete).
- `Reference` rows are cleaned up when either endpoint is hard-deleted (rare).
