export const VISUAL_FIXTURE_IDS = {
  approval: "visual-approval-budget",
  page: "visual-page-roadmap",
} as const;

export type VisualScreen = {
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

export const VISUAL_SCREENS: VisualScreen[] = [
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
