import { prisma } from "@hibi/db";

const E2E_ACCOUNT_ID = "seed-account-e2e";

await prisma.account.upsert({
  where: { id: E2E_ACCOUNT_ID },
  update: {},
  create: {
    id: E2E_ACCOUNT_ID,
    name: "E2E Operations Account",
    kind: "CASH",
    currency: "USD",
  },
});

await prisma.$disconnect();
