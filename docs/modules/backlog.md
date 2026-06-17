# Module: Backlog

## Purpose
Track work as tasks and epics with status, priority, and assignment. Board and list views.

## Entities
```prisma
model Task {
  id          String   @id @default(cuid())
  title       String
  description String?
  status      TaskStatus @default(BACKLOG)
  priority    Priority   @default(MEDIUM)
  assigneeId  String?
  parentId    String?      // epic grouping (self-relation)
  order       Float        // fractional ranking for drag-and-drop
  deletedAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum TaskStatus { BACKLOG TODO IN_PROGRESS DONE }
enum Priority   { LOW MEDIUM HIGH URGENT }
```

## Behaviour
- **Ranking**: use fractional `order` (insert between neighbours) to avoid renumbering on
  reorder. Rebalance lazily if gaps get too small.
- **Epics**: a Task with children (`parentId`). One level of nesting in v1.
- **Views**: board groups by `status`; list sorts by `order` or any column.
- **Links**: a Task can reference a spec Page or a budget ApprovalRequest via `Reference`.

## API (tRPC router `backlog`)
- `list({ status?, assigneeId?, parentId? })`
- `get({ id })`
- `create({ title, ... })`
- `update({ id, patch })`
- `reorder({ id, beforeId?, afterId? })`
- `setStatus({ id, status })`
- `softDelete({ id })`

## Notes
- No approval gating here. Status changes are free.
- Emit AuditLog only for create/delete (not every field edit) to keep noise down.
