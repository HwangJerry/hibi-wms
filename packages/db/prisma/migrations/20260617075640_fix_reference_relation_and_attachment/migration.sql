-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'ATTACHMENT';

-- Keep one existing unlabeled reference per endpoint pair before backfilling.
DELETE FROM "Reference"
WHERE "id" IN (
    SELECT "id"
    FROM (
        SELECT
            "id",
            row_number() OVER (
                PARTITION BY "fromType", "fromId", "toType", "toId"
                ORDER BY "createdAt", "id"
            ) AS "duplicateRank"
        FROM "Reference"
        WHERE "relation" IS NULL
    ) "rankedReferences"
    WHERE "duplicateRank" > 1
);

-- Backfill unlabeled references before enforcing the non-null unique key column.
UPDATE "Reference"
SET "relation" = '__unlabeled__'
WHERE "relation" IS NULL;

-- AlterTable
ALTER TABLE "Reference" ALTER COLUMN "relation" SET NOT NULL,
ALTER COLUMN "relation" SET DEFAULT '__unlabeled__';
