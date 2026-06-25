import { type Page, expect, test } from "@playwright/test";

type UserCredential = {
  email: string;
  password: string;
};

const ALICE: UserCredential = {
  email: "alex@hibi.local",
  password: "alex-local-password",
};

const JAMIE: UserCredential = {
  email: "jamie@hibi.local",
  password: "jamie-local-password",
};

const FINANCE_ACCOUNT_ID = "seed-account-e2e";

function randomTag(prefix: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${suffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractApprovalId(payload: unknown): string | null {
  const visited = new Set<unknown>();

  const walk = (node: unknown): string | null => {
    if (node === null || node === undefined || visited.has(node)) {
      return null;
    }

    if (
      typeof node === "string" ||
      typeof node === "number" ||
      typeof node === "boolean" ||
      typeof node === "bigint" ||
      typeof node === "symbol" ||
      typeof node === "function"
    ) {
      return null;
    }

    visited.add(node);

    if (Array.isArray(node)) {
      for (const item of node) {
        const fromItem = walk(item);
        if (fromItem) {
          return fromItem;
        }
      }

      return null;
    }

    if (!isRecord(node)) {
      return null;
    }

    if (typeof node.approvalId === "string" && node.approvalId.length > 0) {
      return node.approvalId;
    }

    const values = Object.values(node);
    for (const value of values) {
      const fromValue = walk(value);
      if (fromValue) {
        return fromValue;
      }
    }

    return null;
  };

  return walk(payload);
}

async function login(page: Page, user: UserCredential): Promise<void> {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email" }).fill(user.email);
  await page.getByRole("textbox", { name: "Password" }).fill(user.password);

  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/(backlog|finance|approvals|docs)/);
}

async function waitForCreateTaskPanel(page: Page) {
  return page
    .locator("aside")
    .filter({ has: page.getByRole("heading", { name: "Create task" }) })
    .first();
}

test("login redirects into workspace", async ({ page }) => {
  await login(page, ALICE);
  await expect(page.getByRole("heading", { name: "Backlog" })).toBeVisible();
});

test("create and move a backlog task", async ({ page }) => {
  await login(page, ALICE);

  const taskTitle = randomTag("E2E task");

  await page.getByRole("button", { name: "New task" }).click();

  const createTaskPanel = await waitForCreateTaskPanel(page);
  const titleInput = createTaskPanel.getByRole("textbox").first();

  await titleInput.fill(taskTitle);
  await createTaskPanel.getByRole("textbox").nth(1).fill("Created by e2e test flow.");
  await createTaskPanel.getByRole("button", { name: "Save" }).click();

  const taskRow = page.getByRole("button", { name: new RegExp(taskTitle, "i") }).first();
  await expect(taskRow).toBeVisible();

  const statusSelect = page.getByRole("combobox", {
    name: `Change status for ${taskTitle}`,
  });
  await statusSelect.selectOption("IN_PROGRESS");
  await expect(statusSelect).toHaveValue("IN_PROGRESS");
});

test("co-edit a document in two sessions", async ({ browser }) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();

  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  const documentTitle = randomTag("E2E doc");
  const authorText = randomTag("Author note");
  const reviewerText = randomTag("Reviewer note");

  try {
    await login(firstPage, ALICE);
    await firstPage.goto("/docs");
    await firstPage.getByRole("button", { name: "New page" }).click();

    const titleInput = firstPage.getByLabel("Edit page title");
    await expect(titleInput).toBeVisible();
    await titleInput.fill(documentTitle);
    await titleInput.press("Enter");

    const selectedPageId = new URL(firstPage.url()).searchParams.get("pageId");
    expect(selectedPageId).not.toBeNull();

    const authorEditor = firstPage.locator("[aria-label='Page content'] [contenteditable='true']");

    await authorEditor.click();
    await authorEditor.type(authorText);

    await login(secondPage, JAMIE);
    await secondPage.goto(`/docs?pageId=${selectedPageId}`);

    const reviewerTitle = secondPage.getByLabel("Edit page title");
    await expect(reviewerTitle).toHaveValue(documentTitle);

    const reviewerEditor = secondPage.locator("[aria-label='Page content'] [contenteditable='true']");
    await expect(reviewerEditor).toContainText(authorText);

    await reviewerEditor.click();
    await reviewerEditor.type(reviewerText);

    await expect(authorEditor).toContainText([authorText, reviewerText]);
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});

test("create a gated transaction and approve it", async ({ browser }) => {
  const creatorContext = await browser.newContext();

  const creatorPage = await creatorContext.newPage();

  const approvalReason = randomTag("E2E gated approval");

  try {
    await login(creatorPage, JAMIE);
    await creatorPage.goto("/finance");

    await creatorPage.getByRole("button", { name: "New transaction" }).click();

    const createTransactionPanel = creatorPage.locator("form").filter({
      has: creatorPage.getByRole("heading", { name: "Create transaction" }),
    });

    await createTransactionPanel.getByLabel("Account").selectOption(FINANCE_ACCOUNT_ID);
    await createTransactionPanel.getByLabel("Amount").fill("1500.00");
    await createTransactionPanel.getByRole("checkbox", { name: "Force approval request" }).check();
    await createTransactionPanel.getByLabel("Reason").fill(approvalReason);

    const createResponse = creatorPage.waitForResponse((response) => {
      return response.url().includes("/trpc/finance.transactions.create") && response.status() === 200;
    });

    await createTransactionPanel.getByRole("button", { name: "Create" }).click();

    const response = await createResponse;
    const responseBody = await response.json();
    const approvalId = extractApprovalId(responseBody);

    expect(approvalId).not.toBeNull();

    await login(creatorPage, ALICE);
    await creatorPage.goto(`/approvals/${approvalId}`);

    const approveButton = creatorPage.getByRole("button", { name: "Approve" });
    await expect(approveButton).toBeEnabled();
    await approveButton.click();

    await expect(creatorPage.getByText("APPROVED")).toBeVisible();
  } finally {
    await creatorContext.close();
  }
});
