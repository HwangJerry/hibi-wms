-- Add Task domain primitives if they are not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'TaskStatus'
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
  ) THEN
    CREATE TYPE "TaskStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'Priority'
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
  ) THEN
    CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "Task" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'BACKLOG',
  "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
  "assigneeId" TEXT,
  "parentId" TEXT,
  "order" DOUBLE PRECISION NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Task_status_order_idx" ON "Task" ("status", "order");
CREATE INDEX IF NOT EXISTS "Task_assigneeId_idx" ON "Task" ("assigneeId");
CREATE INDEX IF NOT EXISTS "Task_parentId_order_idx" ON "Task" ("parentId", "order");
CREATE INDEX IF NOT EXISTS "Task_deletedAt_idx" ON "Task" ("deletedAt");

DO $$
DECLARE
  task_relation regclass;
BEGIN
  task_relation := to_regclass('"Task"');

  IF task_relation IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'Task_assigneeId_fkey'
        AND conrelid = task_relation
    ) THEN
      ALTER TABLE "Task"
        ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'Task_parentId_fkey'
        AND conrelid = task_relation
    ) THEN
      ALTER TABLE "Task"
        ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END
$$;
