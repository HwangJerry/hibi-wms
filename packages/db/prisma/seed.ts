import { EntityType, prisma } from "../src/index.js";
import { seedUsers } from "./seed-data.js";

async function seedUsersAndSampleData() {
  for (const user of seedUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash: user.passwordHash,
      },
      create: user,
    });
  }

  await prisma.comment.deleteMany({
    where: {
      id: {
        in: ["seed-comment-kickoff", "seed-comment-finance"],
      },
    },
  });
  await prisma.attachment.deleteMany({
    where: { id: "seed-attachment-spec" },
  });
  await prisma.auditLog.deleteMany({
    where: {
      id: {
        in: ["seed-audit-task-created", "seed-audit-approval-requested"],
      },
    },
  });
  await prisma.reference.deleteMany({
    where: {
      id: {
        in: ["seed-reference-task-approval"],
      },
    },
  });

  await prisma.comment.createMany({
    data: [
      {
        id: "seed-comment-kickoff",
        authorId: seedUsers[0].id,
        body: "Kickoff note for the local sample workspace.",
      },
      {
        id: "seed-comment-finance",
        authorId: seedUsers[1].id,
        body: "Sample finance review comment for local development.",
      },
    ],
  });

  await prisma.attachment.create({
    data: {
      id: "seed-attachment-spec",
      uploaderId: seedUsers[0].id,
      fileName: "sample-spec.md",
      mimeType: "text/markdown",
      sizeBytes: 512,
      r2Key: "local-dev/sample-spec.md",
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        id: "seed-audit-task-created",
        actorId: seedUsers[0].id,
        action: "task.created",
        entityType: EntityType.TASK,
        entityId: "seed-task-kickoff",
        data: {
          title: "Plan Phase 1 backlog",
          status: "todo",
        },
      },
      {
        id: "seed-audit-approval-requested",
        actorId: seedUsers[1].id,
        action: "approval.requested",
        entityType: EntityType.APPROVAL,
        entityId: "seed-approval-finance",
        data: {
          amount: 120000,
          currency: "KRW",
          reason: "Sample local approval request",
        },
      },
    ],
  });

  await prisma.reference.create({
    data: {
      id: "seed-reference-task-approval",
      fromType: EntityType.TASK,
      fromId: "seed-task-kickoff",
      toType: EntityType.APPROVAL,
      toId: "seed-approval-finance",
      relation: "requires_approval",
    },
  });
}

async function main() {
  await seedUsersAndSampleData();
  console.log(`Seeded ${seedUsers.length} users and sample data.`);
}

await main();
await prisma.$disconnect();
