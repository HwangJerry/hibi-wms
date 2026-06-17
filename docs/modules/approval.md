# Module: Approval

## Purpose
A single, generic sign-off engine reused by Finance and by work decisions. One request,
one approver, an explicit state machine, and a complete audit trail.

## Entities
```prisma
model ApprovalRequest {
  id          String   @id @default(cuid())
  type        ApprovalType        // FINANCIAL | WORK
  title       String
  description String?
  requesterId String
  approverId  String              // defaults to "the other partner"
  state       ApprovalState @default(PENDING)
  decidedAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  actions     ApprovalAction[]
}

model ApprovalAction {
  id         String   @id @default(cuid())
  requestId  String
  actorId    String
  action     ApprovalActionKind  // SUBMIT | APPROVE | REJECT | CANCEL | COMMENT
  note       String?
  createdAt  DateTime @default(now())
  request    ApprovalRequest @relation(fields: [requestId], references: [id])
}

enum ApprovalType       { FINANCIAL WORK }
enum ApprovalState      { DRAFT PENDING APPROVED REJECTED CANCELLED }
enum ApprovalActionKind { SUBMIT APPROVE REJECT CANCEL COMMENT }
```

## State machine
```
DRAFT --submit--> PENDING --approve--> APPROVED
                       |--reject---> REJECTED
                       |--cancel---> CANCELLED   (requester only)
```
- Only the **approver** may approve/reject. The **requester** may cancel while PENDING.
- Two-partner default: `approverId` = the user who is not the requester. Keep it a field
  so it generalizes if a team is added.
- Every transition writes an `ApprovalAction` and an `AuditLog` entry in the same DB tx.
- Terminal states (APPROVED/REJECTED/CANCELLED) are immutable.

## How other modules use it
- A module creates an `ApprovalRequest` and stores its id (e.g. `Transaction.approvalId`).
- The module subscribes to / checks the request's state before acting. Finance posts a
  transaction only after the linked request reaches `APPROVED`.
- Link the request to the originating entity with a `Reference` for navigation.

## API (tRPC router `approval`)
- `list({ state?, type?, mine? })`
- `get({ id })`
- `create({ type, title, description?, approverId? })`  // starts DRAFT or PENDING
- `submit({ id })` · `approve({ id, note? })` · `reject({ id, note? })` · `cancel({ id })`
- `comment({ id, note })`

## Notes
- The engine is intentionally generic — it knows nothing about money. Finance interprets
  what an approved FINANCIAL request means.
