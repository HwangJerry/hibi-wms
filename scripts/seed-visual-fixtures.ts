import { Prisma, prisma } from "@hibi/db";
import { seedUsers } from "../packages/db/prisma/seed-data.js";

export const VISUAL_FIXTURE_IDS = {
  userAlex: "seed-user-alex",
  userJamie: "seed-user-jamie",
  sessionUser: "seed-user-alex",
  approval: "visual-approval-budget",
  account: "visual-account-main",
  incomeCategory: "visual-category-income",
  space: "visual-space-product",
  page: "visual-page-roadmap",
} as const;

const VISUAL_BACKLOG_TASKS = [
  {
    id: "WMS-142",
    title: "Reconcile Q2 vendor invoices",
    description:
      "Match all 14 vendor invoices against the Q2 general ledger. Flag any discrepancy over $500 for partner sign-off before month close. Acme Corp and Halcyon Labs invoices take priority — both are over $20k.",
    status: "IN_PROGRESS",
    priority: "URGENT",
    assigneeId: VISUAL_FIXTURE_IDS.userJamie,
    updatedHoursAgo: 2,
  },
  {
    id: "WMS-141",
    title: "Draft partnership budget memo",
    description: "Prepare partner review notes for the Q3 operating budget.",
    status: "IN_REVIEW",
    priority: "HIGH",
    assigneeId: VISUAL_FIXTURE_IDS.userAlex,
    updatedHoursAgo: 5,
  },
  {
    id: "WMS-140",
    title: "Migrate docs to new wiki space",
    description: "Move the existing finance and operating docs to the new workspace.",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    assigneeId: VISUAL_FIXTURE_IDS.userJamie,
    updatedHoursAgo: 30,
  },
  {
    id: "WMS-137",
    title: "Set up recurring tax reserve transfer",
    description: "Configure the recurring reserve transfer for quarterly tax planning.",
    status: "TODO",
    priority: "MEDIUM",
    assigneeId: VISUAL_FIXTURE_IDS.userAlex,
    updatedHoursAgo: 48,
  },
  {
    id: "WMS-135",
    title: "Renew domain & SSL certificates",
    description: "Renew production domain and certificate records before expiry.",
    status: "TODO",
    priority: "HIGH",
    assigneeId: VISUAL_FIXTURE_IDS.userJamie,
    updatedHoursAgo: 48,
  },
  {
    id: "WMS-134",
    title: "Review insurance renewal quote",
    description: "Review the renewal quote and flag any meaningful premium change.",
    status: "BLOCKED",
    priority: "HIGH",
    assigneeId: VISUAL_FIXTURE_IDS.userJamie,
    updatedHoursAgo: 72,
  },
  {
    id: "WMS-131",
    title: "Write Q3 partnership goals doc",
    description: "Draft the operating goals document for the Q3 partner review.",
    status: "TODO",
    priority: "MEDIUM",
    assigneeId: VISUAL_FIXTURE_IDS.userAlex,
    updatedHoursAgo: 72,
  },
  {
    id: "WMS-129",
    title: "Annual entity compliance filing",
    description: "Prepare the annual entity compliance filing checklist.",
    status: "BACKLOG",
    priority: "LOW",
    assigneeId: VISUAL_FIXTURE_IDS.userAlex,
    updatedHoursAgo: 96,
  },
] as const;

const VISUAL_TASK_IDS = VISUAL_BACKLOG_TASKS.map((task) => task.id);
const LEGACY_VISUAL_TASK_ID_PREFIX = "visual-task-";

const VISUAL_FINANCE_CATEGORIES = [
  { id: "visual-category-infrastructure", name: "Infrastructure", kind: "EXPENSE" },
  { id: "visual-category-contractors", name: "Contractors", kind: "EXPENSE" },
  { id: "visual-category-software", name: "Software", kind: "EXPENSE" },
  { id: "visual-category-travel", name: "Travel", kind: "EXPENSE" },
  { id: "visual-category-operations", name: "Operations", kind: "EXPENSE" },
] as const;
const VISUAL_FINANCE_CATEGORY_IDS = [
  VISUAL_FIXTURE_IDS.incomeCategory,
  ...VISUAL_FINANCE_CATEGORIES.map((category) => category.id),
];
const VISUAL_BUDGETS = [
  { id: "visual-budget-01", categoryId: "visual-category-infrastructure", limit: "8000.00", actual: "7350.00" },
  { id: "visual-budget-02", categoryId: "visual-category-contractors", limit: "6200.00", actual: "7150.00" },
  { id: "visual-budget-03", categoryId: "visual-category-software", limit: "4200.00", actual: "3475.00" },
  { id: "visual-budget-04", categoryId: "visual-category-travel", limit: "2600.00", actual: "3100.00" },
  { id: "visual-budget-05", categoryId: "visual-category-operations", limit: "5000.00", actual: "4400.00" },
] as const;
const VISUAL_BUDGET_IDS = VISUAL_BUDGETS.map((budget) => budget.id);
const VISUAL_TRANSACTION_IDS = Array.from({ length: VISUAL_BUDGETS.length + 3 }, (_, index) => {
  return `visual-transaction-${String(index + 1).padStart(2, "0")}`;
});

const FIXED_NOW = new Date("2026-06-18T09:00:00.000Z");
const FIXED_MONTH_START = new Date("2026-06-01T00:00:00.000Z");
const FIXED_MONTH_END = new Date("2026-06-30T23:59:59.999Z");

async function seedBaseUsers() {
  for (const user of seedUsers) {
    const visualName =
      user.id === VISUAL_FIXTURE_IDS.userAlex
        ? "Aria Kessler"
        : user.id === VISUAL_FIXTURE_IDS.userJamie
          ? "Devon Miles"
          : user.name;

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: visualName,
        passwordHash: user.passwordHash,
      },
      create: {
        ...user,
        name: visualName,
      },
    });
  }
}

async function clearVisualData() {
  await prisma.pageVersion.deleteMany({
    where: { pageId: VISUAL_FIXTURE_IDS.page },
  });
  await prisma.page.deleteMany({
    where: { id: VISUAL_FIXTURE_IDS.page },
  });
  await prisma.space.deleteMany({
    where: { id: VISUAL_FIXTURE_IDS.space },
  });
  await prisma.transaction.deleteMany({
    where: {
      id: { startsWith: "visual-transaction-" },
    },
  });
  await prisma.budget.deleteMany({
    where: { id: { startsWith: "visual-budget-" } },
  });
  await prisma.category.deleteMany({
    where: { id: { in: VISUAL_FINANCE_CATEGORY_IDS } },
  });
  await prisma.account.deleteMany({
    where: { id: VISUAL_FIXTURE_IDS.account },
  });
  await prisma.approvalAction.deleteMany({
    where: { requestId: VISUAL_FIXTURE_IDS.approval },
  });
  await prisma.approvalRequest.deleteMany({
    where: { id: VISUAL_FIXTURE_IDS.approval },
  });
  await prisma.task.deleteMany({
    where: {
      OR: [
        { id: { in: VISUAL_TASK_IDS } },
        { id: { startsWith: LEGACY_VISUAL_TASK_ID_PREFIX } },
      ],
    },
  });
}

async function seedBacklog() {
  await prisma.task.createMany({
    data: VISUAL_BACKLOG_TASKS.map((task, index) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      parentId: null,
      order: (index + 1) * 1024,
      createdAt: new Date(FIXED_NOW.getTime() - (index + 1) * 86_400_000),
      updatedAt: new Date(FIXED_NOW.getTime() - task.updatedHoursAgo * 3_600_000),
    })),
  });
}

async function seedApprovals() {
  await prisma.approvalRequest.create({
    data: {
      id: VISUAL_FIXTURE_IDS.approval,
      type: "FINANCIAL",
      title: "Approve June infrastructure budget",
      description: JSON.stringify({
        amount: 4200,
        currency: "USD",
        period: "monthly",
        account: "Operations",
        category: "Infrastructure",
        vendor: "Cloud hosting",
        memo: "Visual parity fixture approval.",
      }),
      requesterId: VISUAL_FIXTURE_IDS.userJamie,
      approverId: VISUAL_FIXTURE_IDS.userAlex,
      state: "PENDING",
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
      actions: {
        create: [
          {
            id: "visual-approval-action-submit",
            actorId: VISUAL_FIXTURE_IDS.userJamie,
            action: "SUBMIT",
            note: "Submitted for visual parity review.",
            createdAt: FIXED_NOW,
          },
        ],
      },
    },
  });
}

async function seedFinance() {
  await prisma.account.create({
    data: {
      id: VISUAL_FIXTURE_IDS.account,
      name: "Operations Cash",
      kind: "CASH",
      currency: "USD",
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
  });

  await prisma.category.createMany({
    data: [
      {
        id: VISUAL_FIXTURE_IDS.incomeCategory,
        name: "Client retainers",
        kind: "INCOME",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      },
      ...VISUAL_FINANCE_CATEGORIES.map((category) => ({
        id: category.id,
        name: category.name,
        kind: category.kind,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      })),
    ],
  });

  await prisma.budget.createMany({
    data: VISUAL_BUDGETS.map((budget) => ({
      id: budget.id,
      categoryId: budget.categoryId,
      periodStart: FIXED_MONTH_START,
      periodEnd: FIXED_MONTH_END,
      limit: new Prisma.Decimal(budget.limit),
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    })),
  });

  await prisma.transaction.createMany({
    data: VISUAL_TRANSACTION_IDS.map((id, index) => {
      const budget = VISUAL_BUDGETS[index];
      const isIncome = budget === undefined;
      const status = index === VISUAL_TRANSACTION_IDS.length - 1 ? "PENDING" : "POSTED";

      return {
        id,
        accountId: VISUAL_FIXTURE_IDS.account,
        categoryId: isIncome
          ? VISUAL_FIXTURE_IDS.incomeCategory
          : budget.categoryId,
        amount: new Prisma.Decimal(isIncome ? "12000.00" : budget.actual),
        currency: "USD",
        description: isIncome
          ? "Monthly retainer"
          : `${VISUAL_FINANCE_CATEGORIES[index]?.name ?? "Operating"} service`,
        status,
        approvalId: index === 1 ? VISUAL_FIXTURE_IDS.approval : null,
        occurredAt: new Date(FIXED_NOW.getTime() - index * 86_400_000),
        postedAt: status === "POSTED"
          ? new Date(FIXED_NOW.getTime() - index * 86_400_000)
          : null,
        reversedById: null,
        createdAt: new Date(FIXED_NOW.getTime() - index * 86_400_000),
        updatedAt: new Date(FIXED_NOW.getTime() - index * 3_600_000),
      };
    }),
  });
}

async function seedDocs() {
  await prisma.space.create({
    data: {
      id: VISUAL_FIXTURE_IDS.space,
      name: "Product workspace",
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
  });

  await prisma.page.create({
    data: {
      id: VISUAL_FIXTURE_IDS.page,
      spaceId: VISUAL_FIXTURE_IDS.space,
      parentId: null,
      title: "Launch operating notes",
      yDoc: new Uint8Array(),
      textProjection:
        "Visual parity fixture page for product planning and launch notes.",
      order: 1024,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
  });
}

async function main() {
  await seedBaseUsers();
  await clearVisualData();
  await seedBacklog();
  await seedApprovals();
  await seedFinance();
  await seedDocs();
}

main()
  .then(() => {
    console.log("Seeded deterministic visual parity fixtures.");
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
