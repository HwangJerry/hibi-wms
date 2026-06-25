import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { appendFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test, expect, type Browser, type Page } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const VISUAL_PARITY_THRESHOLDS = {
  pageDiffRatio: 0.005,
  criticalRegionDiffRatio: 0.0025,
  listRegionDiffRatio: 0.001,
  domPixelTolerance: 1,
} as const;

const BACKLOG_LIST_GRID_COLUMNS = "26px minmax(220px,1fr) 128px 104px 80px 64px 28px";
const BACKLOG_LIST_HEADER_HEIGHT = 30;
const BACKLOG_LIST_ROW_HEIGHT = 34;
const BACKLOG_LIST_CHECKBOX_SIZE = 15;
const ARTIFACT_ROOT = resolve("test-results/visual-parity");
const REPORT_JSONL_PATH = resolve(ARTIFACT_ROOT, "report.jsonl");
const REPORT_PATH = resolve("docs/visual-parity-report.md");
const MOCKUPS_ROOT = resolve("design/mockups");
const TOKEN_README_PATH = resolve("packages/ui/tokens/README.md");
const SCAN_ROOTS = ["apps/web/src", "packages/ui/src"];
const RAW_HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
const ARBITRARY_PX_CLASS_PATTERN = /[a-z-]+-\[[0-9]+px\]/g;
const INLINE_PX_PATTERN = /["'`][^"'`]*[0-9]+px[^"'`]*["'`]/g;

type VisualReportEntry = {
  screen: string;
  viewport: string;
  mockup: string;
  route: string;
  diffRatio: number | null;
  threshold: number | null;
  status: "PASS" | "FAIL";
  artifacts: string[];
  notes: string[];
};

type VisualScreen = {
  id:
    | "backlog-list"
    | "backlog-board"
    | "task-detail"
    | "approvals"
    | "approval-detail"
    | "finance-dashboard"
    | "finance-transactions"
    | "docs"
    | "foundation"
    | "system-components";
  label: string;
  mockupFile: string;
  appPath: string;
  mockupScreenLabelPrefix: string;
};

const VISUAL_FIXTURE_IDS = {
  approval: "visual-approval-budget",
  page: "visual-page-roadmap",
} as const;

const VISUAL_SCREENS: VisualScreen[] = [
  {
    id: "backlog-list",
    label: "Backlog List",
    mockupFile: "WMS Backlog List.dc.html",
    appPath: "/backlog?view=list",
    mockupScreenLabelPrefix: "Backlog List",
  },
  {
    id: "backlog-board",
    label: "Backlog Board",
    mockupFile: "WMS Backlog Board.dc.html",
    appPath: "/backlog?view=board",
    mockupScreenLabelPrefix: "Backlog Board",
  },
  {
    id: "task-detail",
    label: "Task Detail",
    mockupFile: "WMS Task Detail.dc.html",
    appPath: "/backlog?view=list&visual=task-detail",
    mockupScreenLabelPrefix: "Task Detail",
  },
  {
    id: "approvals",
    label: "Approvals",
    mockupFile: "WMS Approvals.dc.html",
    appPath: "/approvals",
    mockupScreenLabelPrefix: "Approvals",
  },
  {
    id: "approval-detail",
    label: "Approval Detail",
    mockupFile: "WMS Approval Detail.dc.html",
    appPath: `/approvals/${VISUAL_FIXTURE_IDS.approval}`,
    mockupScreenLabelPrefix: "Approval Detail",
  },
  {
    id: "finance-dashboard",
    label: "Finance Dashboard",
    mockupFile: "WMS Finance Dashboard.dc.html",
    appPath: "/finance?view=overview",
    mockupScreenLabelPrefix: "Finance Dashboard",
  },
  {
    id: "finance-transactions",
    label: "Finance Transactions",
    mockupFile: "WMS Finance Transactions.dc.html",
    appPath: "/finance?view=transactions",
    mockupScreenLabelPrefix: "Finance Transactions",
  },
  {
    id: "docs",
    label: "Docs",
    mockupFile: "WMS Docs.dc.html",
    appPath: `/docs?pageId=${VISUAL_FIXTURE_IDS.page}`,
    mockupScreenLabelPrefix: "Docs",
  },
  {
    id: "foundation",
    label: "Foundation",
    mockupFile: "WMS Foundation.dc.html",
    appPath: "/backlog?view=list",
    mockupScreenLabelPrefix: "App Shell",
  },
  {
    id: "system-components",
    label: "System Components",
    mockupFile: "WMS System Components.dc.html",
    appPath: "/visual/command-palette",
    mockupScreenLabelPrefix: "Command Palette",
  },
];

const reportEntries: VisualReportEntry[] = [];

test.afterAll(() => {
  writeVisualParityReport();
});

test.describe("mockup-to-app visual parity", () => {
  for (const screen of VISUAL_SCREENS) {
    test(`${screen.label} matches committed mockup`, async ({ browser, baseURL }, testInfo) => {
      const viewport = testInfo.project.name.includes("mobile") ? "mobile" : "desktop";
      const artifactDir = resolve(ARTIFACT_ROOT, viewport, screen.id);
      const expectedPath = resolve(artifactDir, "mockup.png");
      const actualPath = resolve(artifactDir, "app.png");
      const diffPath = resolve(artifactDir, "diff.png");
      const artifacts = [expectedPath, actualPath, diffPath];

      mkdirSync(artifactDir, { recursive: true });

      const mockupPage = await newPage(browser, testInfo.project.use.viewport);
      const appPage = await newPage(browser, testInfo.project.use.viewport);

      try {
        await login(appPage, baseURL ?? "http://127.0.0.1:5173");
        await mockupPage.goto(getMockupUrl(screen.mockupFile), { waitUntil: "networkidle" });
        const mockupScreen = getMockupScreenLocator(mockupPage, screen);
        await expect(mockupScreen).toBeVisible();
        const mockupBox = await mockupScreen.boundingBox();
        if (!mockupBox) {
          throw new Error(`Missing mockup screen bounds for ${screen.label}.`);
        }

        await appPage.setViewportSize({
          width: Math.round(mockupBox.width),
          height: Math.round(mockupBox.height),
        });
        await appPage.goto(screen.appPath, { waitUntil: "networkidle" });
        await expect(appPage.locator("#root")).toBeVisible();
        await prepareAppScreen(appPage, screen.id);

        await disableVolatileRendering(mockupPage);
        await disableVolatileRendering(appPage);
        await waitForFonts(mockupPage);
        await waitForFonts(appPage);

        await assertDataDrivenDesignInvariants(appPage, screen);
        await maskDynamicTextContent(mockupPage);
        await maskDynamicTextContent(appPage);

        await mockupScreen.screenshot({ path: expectedPath });
        await appPage.screenshot({ path: actualPath });

        const pageDiff = comparePngFiles({
          actualPath,
          expectedPath,
          diffPath,
        });
        const status =
          pageDiff.diffRatio <= VISUAL_PARITY_THRESHOLDS.pageDiffRatio
            ? "PASS"
            : "FAIL";

        addVisualReportEntry({
          screen: screen.label,
          viewport,
          mockup: screen.mockupFile,
          route: screen.appPath,
          diffRatio: pageDiff.diffRatio,
          threshold: VISUAL_PARITY_THRESHOLDS.pageDiffRatio,
          status,
          artifacts,
          notes: ["Text content is masked for screenshot diff; typography and layout are checked by DOM invariants."],
        });

        expect(pageDiff.diffRatio).toBeLessThanOrEqual(
          VISUAL_PARITY_THRESHOLDS.pageDiffRatio,
        );

      } finally {
        await mockupPage.context().close();
        await appPage.context().close();
      }
    });
  }

  for (const screen of VISUAL_SCREENS) {
    test(`${screen.label} preserves data-driven design invariants`, async ({ browser, baseURL }, testInfo) => {
      const viewport = testInfo.project.name.includes("mobile") ? "mobile" : "desktop";
      const appPage = await newPage(browser, testInfo.project.use.viewport);

      try {
        await login(appPage, baseURL ?? "http://127.0.0.1:5173");
        await appPage.goto(screen.appPath, { waitUntil: "networkidle" });
        await expect(appPage.locator("#root")).toBeVisible();
        await prepareAppScreen(appPage, screen.id);
        await disableVolatileRendering(appPage);
        await waitForFonts(appPage);
        await assertDataDrivenDesignInvariants(appPage, screen);

        addVisualReportEntry({
          screen: `${screen.label} design invariants`,
          viewport,
          mockup: screen.mockupFile,
          route: screen.appPath,
          diffRatio: null,
          threshold: null,
          status: "PASS",
          artifacts: [],
          notes: ["Verified with rendered app data, not hard-coded mockup content."],
        });
      } finally {
        await appPage.context().close();
      }
    });
  }

  test("raw visual values are tokenized or documented", async () => {
    const documentedExceptionFiles = readDocumentedRawVisualValueExceptions();
    const violations = listSourceFiles(SCAN_ROOTS).flatMap((file) => {
      return findRawVisualValueViolations(file, documentedExceptionFiles);
    });

    addVisualReportEntry({
      screen: "Raw visual value audit",
      viewport: "source",
      mockup: "design/mockups/*.dc.html",
      route: "apps/web/src + packages/ui/src",
      diffRatio: null,
      threshold: null,
      status: violations.length === 0 ? "PASS" : "FAIL",
      artifacts: [],
      notes: violations.slice(0, 20),
    });

    expect(violations).toEqual([]);
  });
});

async function newPage(browser: Browser, viewport: unknown) {
  const context = await browser.newContext({
    viewport: isViewportSize(viewport) ? viewport : { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "Asia/Seoul",
  });

  return await context.newPage();
}

async function login(page: Page, baseURL: string) {
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });

  if (page.url().includes("/login")) {
    await page.getByRole("textbox", { name: "Email" }).fill("alex@hibi.local");
    await page.getByRole("textbox", { name: "Password" }).fill("alex-local-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/(backlog|finance|approvals|docs)/);
  }
}

async function prepareAppScreen(page: Page, screenId: string) {
  if (screenId === "system-components") {
    await expect(page.locator("[data-visual-region='command-palette']")).toBeVisible({
      timeout: 5_000,
    });
    return;
  }

  if (screenId === "finance-dashboard") {
    await expect(page.locator("[data-visual-region='finance-dashboard']")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Loading finance data")).toHaveCount(0);
    return;
  }

  if (screenId !== "task-detail") {
    return;
  }

  const firstTask = page
    .locator("[data-visual-region='backlog-list-row']")
    .first()
    .locator("button")
    .nth(1);
  await expect(firstTask).toBeVisible();
  await firstTask.click();
  await expect(page.locator("[data-visual-region='task-detail-readonly']")).toBeVisible();
}

function getMockupScreenLocator(page: Page, screen: VisualScreen) {
  return page
    .locator(`[data-screen-label^="${screen.mockupScreenLabelPrefix}"]`)
    .first();
}

async function assertDataDrivenDesignInvariants(page: Page, screen: VisualScreen) {
  await assertRuntimeTokenContract(page);

  if (screen.id === "system-components") {
    await assertCommandPaletteMetrics(page);
    return;
  }

  await assertWorkspaceShellMetrics(page);

  if (screen.id === "backlog-list" || screen.id === "foundation" || screen.id === "task-detail") {
    await assertBacklogListMetrics(page);
  }
}

async function assertRuntimeTokenContract(page: Page) {
  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      accent: styles.getPropertyValue("--accent").trim(),
      border: styles.getPropertyValue("--border").trim(),
      surface1: styles.getPropertyValue("--surface-1").trim(),
      surface2: styles.getPropertyValue("--surface-2").trim(),
      textPrimary: styles.getPropertyValue("--text-primary").trim(),
      textSecondary: styles.getPropertyValue("--text-secondary").trim(),
      fontFamily: getComputedStyle(document.body).fontFamily,
    };
  });

  expect(tokens).toMatchObject({
    accent: "#5b5bd6",
    border: "#e0e0e4",
    surface1: "#ffffff",
    surface2: "#f7f7f8",
    textPrimary: "#16161a",
    textSecondary: "#62626b",
  });
  expect(tokens.fontFamily).toContain("Inter");
}

async function assertWorkspaceShellMetrics(page: Page) {
  const shell = page.locator("[data-visual-region='workspace-shell']").first();
  const sidebar = page.locator("[data-visual-region='workspace-sidebar']").first();
  const topbar = page.locator("[data-visual-region='workspace-topbar']").first();

  await expect(shell).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(topbar).toBeVisible();

  const sidebarBox = await sidebar.boundingBox();
  const topbarBox = await topbar.boundingBox();

  expectWithinTolerance(sidebarBox?.width, 228);
  expectWithinTolerance(topbarBox?.height, 46);
}

async function assertCommandPaletteMetrics(page: Page) {
  const palette = page.locator("[data-visual-region='command-palette']").first();
  const backdrop = page.locator("[data-visual-region='command-palette-backdrop']").first();

  await expect(backdrop).toBeVisible();
  await expect(palette).toBeVisible();

  const paletteBox = await palette.boundingBox();
  const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
  const expectedPaletteWidth = 524;
  const paletteStyles = await palette.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      background: styles.backgroundColor,
      borderColor: styles.borderTopColor,
      borderRadius: styles.borderTopLeftRadius,
      lineHeight: styles.lineHeight,
    };
  });

  if (viewport.width < expectedPaletteWidth) {
    expect(paletteBox?.width).toBeGreaterThanOrEqual(viewport.width - 8);
    expect(paletteBox?.width).toBeLessThanOrEqual(viewport.width);
  } else {
    expectWithinTolerance(paletteBox?.width, expectedPaletteWidth);
  }
  expect(paletteStyles).toMatchObject({
    background: "rgb(255, 255, 255)",
    borderColor: "rgb(224, 224, 228)",
    borderRadius: "11px",
    lineHeight: "normal",
  });
}

async function assertBacklogListMetrics(page: Page) {
  const header = page.locator("[data-visual-region='backlog-list-header']").first();
  const row = page.locator("[data-visual-region='backlog-list-row']").first();
  const checkbox = page.locator("[data-visual-region='backlog-list-checkbox']").first();

  await expect(header).toBeVisible();
  await expect(row).toBeVisible();
  await expect(checkbox).toBeVisible();

  const headerBox = await header.boundingBox();
  const rowBox = await row.boundingBox();
  const checkboxBox = await checkbox.boundingBox();

  expectWithinTolerance(headerBox?.height, BACKLOG_LIST_HEADER_HEIGHT);
  expectWithinTolerance(rowBox?.height, BACKLOG_LIST_ROW_HEIGHT);
  expectWithinTolerance(checkboxBox?.height, BACKLOG_LIST_CHECKBOX_SIZE);
  expectWithinTolerance(checkboxBox?.width, BACKLOG_LIST_CHECKBOX_SIZE);

  const inlineGridTemplateColumns = await row.evaluate(
    (element) => (element as HTMLElement).style.gridTemplateColumns,
  );
  expect(normalizeCssValue(inlineGridTemplateColumns)).toBe(
    normalizeCssValue(BACKLOG_LIST_GRID_COLUMNS),
  );
}

function normalizeCssValue(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function comparePngFiles({
  actualPath,
  expectedPath,
  diffPath,
}: {
  actualPath: string;
  expectedPath: string;
  diffPath: string;
}) {
  const actual = PNG.sync.read(readFileSync(actualPath));
  const expected = PNG.sync.read(readFileSync(expectedPath));
  const width = Math.min(actual.width, expected.width);
  const height = Math.min(actual.height, expected.height);
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(
    cropPngData(expected, width, height),
    cropPngData(actual, width, height),
    diff.data,
    width,
    height,
    { threshold: 0.1 },
  );
  const totalPixels = width * height;

  mkdirSync(dirname(diffPath), { recursive: true });
  writeFileSync(diffPath, PNG.sync.write(diff));

  return {
    diffPixels,
    totalPixels,
    diffRatio: diffPixels / totalPixels,
  };
}

function cropPngData(image: PNG, width: number, height: number) {
  if (image.width === width && image.height === height) {
    return image.data;
  }

  const cropped = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const sourceStart = y * image.width * 4;
    const targetStart = y * width * 4;
    image.data.copy(cropped, targetStart, sourceStart, sourceStart + width * 4);
  }

  return cropped;
}

function findRawVisualValueViolations(
  file: string,
  documentedExceptionFiles: Set<string>,
) {
  const content = readFileSync(file, "utf8");
  const relativePath = file.replace(`${process.cwd()}/`, "");
  const hexMatches = content.match(RAW_HEX_PATTERN) ?? [];
  const arbitraryPxMatches = content.match(ARBITRARY_PX_CLASS_PATTERN) ?? [];
  const inlinePxMatches = content.match(INLINE_PX_PATTERN) ?? [];
  const hasDocumentedException = documentedExceptionFiles.has(relativePath);
  const violations: string[] = [];

  for (const match of hexMatches) {
    violations.push(`${relativePath}: raw color ${match}`);
  }

  if (!hasDocumentedException) {
    for (const match of arbitraryPxMatches) {
      violations.push(`${relativePath}: arbitrary px class ${match}`);
    }
    for (const match of inlinePxMatches) {
      violations.push(`${relativePath}: inline px value ${match}`);
    }
  }

  return violations;
}

function readDocumentedRawVisualValueExceptions() {
  const content = readFileSync(TOKEN_README_PATH, "utf8");
  const sectionMatch = /<!-- visual-audit-allow:start -->([\s\S]*?)<!-- visual-audit-allow:end -->/.exec(content);

  if (!sectionMatch) {
    throw new Error(`Missing visual-audit-allow section in ${TOKEN_README_PATH}.`);
  }

  const paths = [...sectionMatch[1].matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  if (paths.length === 0) {
    throw new Error(`visual-audit-allow section in ${TOKEN_README_PATH} has no documented paths.`);
  }

  return new Set(paths);
}

function listSourceFiles(roots: string[]) {
  return roots.flatMap((root) => walk(resolve(root)));
}

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return walk(path);
    }

    if (!/\.(ts|tsx|css)$/.test(path)) {
      return [];
    }

    return [path];
  });
}

function addVisualReportEntry(entry: VisualReportEntry) {
  reportEntries.push(entry);
  mkdirSync(dirname(REPORT_JSONL_PATH), { recursive: true });
  appendFileSync(REPORT_JSONL_PATH, `${JSON.stringify(entry)}\n`);
}

function writeVisualParityReport() {
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  const persistedEntries = existsSync(REPORT_JSONL_PATH)
    ? readFileSync(REPORT_JSONL_PATH, "utf8")
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as VisualReportEntry)
    : reportEntries;

  const lines = [
    "# Visual Parity Report",
    "",
    "Generated by `pnpm visual:parity`.",
    "",
    "| Screen | Viewport | Status | Diff | Threshold | Artifacts | Notes |",
    "| --- | --- | --- | ---: | ---: | --- | --- |",
    ...persistedEntries.map((entry) => {
      const diff = entry.diffRatio === null ? "n/a" : entry.diffRatio.toFixed(6);
      const threshold = entry.threshold === null ? "n/a" : entry.threshold.toFixed(6);
      const artifacts = entry.artifacts.length === 0 ? "" : entry.artifacts.join("<br>");
      const notes = entry.notes.length === 0 ? "" : entry.notes.join("<br>");
      const cells = [
        entry.screen,
        entry.viewport,
        entry.status,
        diff,
        threshold,
        artifacts,
        notes,
      ];

      return `| ${cells.join(" | ")} |`;
    }),
    "",
  ];

  writeFileSync(REPORT_PATH, lines.join("\n"));
}

function getMockupUrl(fileName: string) {
  return pathToFileURL(resolve(MOCKUPS_ROOT, fileName)).toString();
}

function expectWithinTolerance(actual: number | undefined, expected: number) {
  expect(actual).toBeDefined();
  expect(Math.abs((actual ?? 0) - expected)).toBeLessThanOrEqual(
    VISUAL_PARITY_THRESHOLDS.domPixelTolerance,
  );
}

function isViewportSize(viewport: unknown): viewport is { width: number; height: number } {
  if (!viewport || typeof viewport !== "object") {
    return false;
  }

  return "width" in viewport && "height" in viewport;
}

async function disableVolatileRendering(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
}

async function maskDynamicTextContent(page: Page) {
  await page.evaluate(() => {
    const maskedAttribute = "data-visual-text-mask";
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          const text = node.textContent ?? "";

          if (!parent || text.trim().length === 0) {
            return NodeFilter.FILTER_REJECT;
          }

          if (parent.closest("script, style, noscript")) {
            return NodeFilter.FILTER_REJECT;
          }

          if (parent.hasAttribute(maskedAttribute)) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );
    const textNodes: Text[] = [];
    let current = walker.nextNode();

    while (current) {
      textNodes.push(current as Text);
      current = walker.nextNode();
    }

    for (const textNode of textNodes) {
      const wrapper = document.createElement("span");
      wrapper.setAttribute(maskedAttribute, "");
      textNode.parentNode?.insertBefore(wrapper, textNode);
      wrapper.appendChild(textNode);
    }
  });
  await page.addStyleTag({
    content: `
      [data-visual-text-mask],
      input,
      textarea {
        color: transparent !important;
        text-shadow: none !important;
      }
    `,
  });
}

async function waitForFonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}
