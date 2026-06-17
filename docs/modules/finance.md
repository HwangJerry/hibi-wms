# Module: Finance

## Purpose
Track money: accounts, categorized transactions, budgets, balances, and reports.
Movements that need sign-off are gated by the Approval module.

## Entities
```prisma
model Account {
  id        String   @id @default(cuid())
  name      String
  kind      AccountKind   // CASH | BANK | CARD | OTHER
  currency  String        // ISO 4217, e.g. "KRW"
  createdAt DateTime @default(now())
}

model Category {
  id    String @id @default(cuid())
  name  String
  kind  CategoryKind   // INCOME | EXPENSE
}

model Transaction {
  id          String   @id @default(cuid())
  accountId   String
  categoryId  String?
  amount      Decimal  @db.Decimal(18, 2)   // positive; direction from category kind
  currency    String
  description String?
  status      TxStatus @default(PENDING)     // PENDING | POSTED | REVERSED
  approvalId  String?                        // required before POSTED if gated
  occurredAt  DateTime
  postedAt    DateTime?
  reversedById String?                       // points to the reversing transaction
  createdAt   DateTime @default(now())
}

model Budget {
  id         String   @id @default(cuid())
  categoryId String
  periodStart DateTime
  periodEnd   DateTime
  limit       Decimal  @db.Decimal(18, 2)
}

enum AccountKind  { CASH BANK CARD OTHER }
enum CategoryKind { INCOME EXPENSE }
enum TxStatus     { PENDING POSTED REVERSED }
```

## Money rules (critical)
- **Amounts** are `Decimal(18,2)` — never floats. Direction comes from the category kind.
- **Gating**: a transaction above a configurable threshold (or any partner-flagged one)
  requires approval. Flow:
  1. `create` → status `PENDING`, create a linked `ApprovalRequest(type=FINANCIAL)`.
  2. On approval, the finance service sets status `POSTED`, stamps `postedAt`, and the
     amount now counts toward balances.
  3. Rejection leaves it `PENDING`/voided — it never posts.
- **No edits/deletes of posted money.** To fix a posted transaction, create a
  **reversing** transaction (equal, opposite) and mark the original `REVERSED`, linking
  the two. This preserves the audit trail.
- Every status change writes an `AuditLog` entry inside the same DB transaction.

## Balances & reports (Phase 3 for reports)
- Account balance = sum of POSTED transactions for that account.
- Budget vs actual = sum of POSTED expense transactions per category in the period.
- Compute on read for v1; add materialized snapshots only if it gets slow.

## API (tRPC router `finance`)
- Accounts/Categories/Budgets: standard CRUD.
- `transactions.list({ accountId?, categoryId?, status?, range? })`
- `transactions.create({ ... })`  // creates PENDING + ApprovalRequest if gated
- `transactions.reverse({ id, reason })`
- `reports.accountBalances()` · `reports.budgetVsActual({ period })`

## Notes
- Single currency per account; cross-currency is out of scope for v1.
- The threshold for "needs approval" is config, not hardcoded.
