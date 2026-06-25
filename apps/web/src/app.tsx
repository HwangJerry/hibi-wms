import {
  ChevronDown,
  CheckSquare,
  CircleDollarSign,
  FileText,
  ListChecks,
  Search as SearchIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  activeSidebarNavItemClassName,
  Avatar,
  Button,
  CommandPalette,
  inactiveSidebarNavItemClassName,
  Input,
  SidebarFooter,
  SidebarHeader,
  SidebarNav,
  SidebarNavItemContent,
  SidebarSearch,
  sidebarNavItemClassName,
  TopBar,
  type CommandItem,
  WorkspaceShell as WorkspaceShellFrame,
} from "@hibi/ui";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { BacklogPage } from "./features/backlog/backlog-page";
import { ApprovalsPage } from "./features/approvals/approvals-page";
import { DocsPage } from "./features/docs/docs-page";
import { TransactionsPage } from "./features/finance/transactions-page";
import { trpc } from "./providers/trpc-provider";

type ThemeMode = "light" | "dark";

const THEME_MODE_KEY = "hibi-theme-mode";

type NavItem = {
  label: string;
  path: string;
  icon: typeof ListChecks;
  visualIcon: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Backlog",
    path: "/backlog",
    icon: ListChecks,
    visualIcon: <BacklogSidebarIcon />,
  },
  {
    label: "Approvals",
    path: "/approvals",
    icon: CheckSquare,
    visualIcon: <ApprovalsSidebarIcon />,
  },
  {
    label: "Finance",
    path: "/finance",
    icon: CircleDollarSign,
    visualIcon: <FinanceSidebarIcon />,
  },
  {
    label: "Docs",
    path: "/docs",
    icon: FileText,
    visualIcon: <DocsSidebarIcon />,
  },
];

function BacklogSidebarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[15px] w-[15px] shrink-0"
      fill="none"
      viewBox="0 0 16 16"
    >
      <rect
        height="2.6"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        width="12"
        x="2"
        y="2.5"
      />
      <rect
        height="2.6"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        width="12"
        x="2"
        y="6.7"
      />
      <rect
        height="2.6"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        width="8"
        x="2"
        y="10.9"
      />
    </svg>
  );
}

function ApprovalsSidebarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[15px] w-[15px] shrink-0"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function FinanceSidebarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[15px] w-[15px] shrink-0"
      fill="none"
      viewBox="0 0 16 16"
    >
      <rect
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        width="12"
        x="2"
        y="3.5"
      />
      <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function DocsSidebarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[15px] w-[15px] shrink-0"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path d="M4 2.5h6l2.5 2.5v9H4z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 2.5V5H12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

type ThemeStorageMode = ThemeMode | null;

const COMMAND_ITEMS: CommandItem[] = [
  {
    id: "goto-backlog",
    group: "Navigate",
    label: "Go to Backlog",
    shortcut: "⌘1",
    meta: "/backlog",
    path: "/backlog",
  },
  {
    id: "goto-approvals",
    group: "Navigate",
    label: "Go to Approvals",
    shortcut: "⌘2",
    meta: "/approvals",
    path: "/approvals",
  },
  {
    id: "goto-finance",
    group: "Navigate",
    label: "Go to Finance",
    shortcut: "⌘3",
    meta: "/finance",
    path: "/finance",
  },
  {
    id: "goto-docs",
    group: "Navigate",
    label: "Go to Docs",
    shortcut: "⌘4",
    meta: "/docs",
    path: "/docs",
  },
  {
    id: "new-task",
    group: "Create",
    label: "Create new task",
    shortcut: "C",
  },
];

const COMMAND_SEARCH_MIN_LENGTH = 2;
const COMMAND_PAGINATED_LIMIT = 5;

const MODIFIED_NAV_SHORTCUT_COMMAND_ID_BY_KEY = {
  "1": "goto-backlog",
  "2": "goto-approvals",
  "3": "goto-finance",
  "4": "goto-docs",
} as const;

const UNMODIFIED_COMMAND_ID_BY_KEY = {
  c: "new-task",
} as const;

const searchEntityLabelByType = {
  TASK: "Task",
  PAGE: "Docs page",
  TRANSACTION: "Transaction",
} as const;

const NAV_LABEL_BY_PATH = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.path, item.label])
) as Record<string, string>;

function getStoredThemeMode(): ThemeStorageMode {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const stored = localStorage.getItem(THEME_MODE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return null;
}

function getSystemThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

function getInitialThemeMode(): ThemeMode {
  return getStoredThemeMode() ?? getSystemThemeMode();
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const editableSelector =
    "input, textarea, select, [contenteditable='true'], [role='textbox']";
  return target.closest(editableSelector) !== null;
}

function getBreadcrumbSegments(pathname: string): string[] {
  const routeLabel = NAV_LABEL_BY_PATH[pathname];

  const normalizedPath = routeLabel ?? pathname.replace(/^\//, "");
  if (normalizedPath.length === 0) {
    return ["Workspace", "Backlog"];
  }

  const leaf =
    normalizedPath.length === 0
      ? "Backlog"
      : `${normalizedPath[0]?.toUpperCase()}${normalizedPath.slice(1)}`;

  return ["Workspace", leaf];
}

function getWorkspaceBreadcrumbSegments(pathname: string, search: string): string[] {
  if (pathname === "/backlog") {
    const view = new URLSearchParams(search).get("view") === "board" ? "Board" : "List";
    return ["Backlog", view];
  }

  return getBreadcrumbSegments(pathname);
}

export function App() {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
  });

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-1 px-6 text-sm text-text-secondary">
        Loading workspace
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={meQuery.isSuccess ? <Navigate to="/backlog" replace /> : <LoginPage />}
      />
      <Route
        path="/visual/command-palette"
        element={
          meQuery.isSuccess ? (
            <VisualCommandPalettePage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="*"
        element={
          meQuery.isSuccess ? (
            <WorkspaceShell
              userId={meQuery.data.user.id}
              userName={meQuery.data.user.name}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

function VisualCommandPalettePage() {
  const [query, setQuery] = useState("new t");
  const visualCommandItems: CommandItem[] = [
    {
      id: "visual-backlog",
      group: "Navigate",
      label: "Backlog",
      meta: "31 tasks",
      leading: <ListChecks className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: "visual-approvals",
      group: "Navigate",
      label: "Approvals",
      meta: "4 pending",
      leading: <CheckSquare className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: "visual-finance",
      group: "Navigate",
      label: "Finance",
      leading: <CircleDollarSign className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: "visual-new-task",
      group: "Create",
      label: "New task",
      shortcut: "C",
    },
    {
      id: "visual-new-transaction",
      group: "Create",
      label: "New transaction",
      shortcut: "N",
    },
    {
      id: "visual-new-approval",
      group: "Create",
      label: "New approval request",
    },
    {
      id: "visual-recent-task",
      group: "Recent",
      label: "Reconcile Q2 vendor invoices",
      meta: "WMS-142",
    },
    {
      id: "visual-recent-doc",
      group: "Recent",
      label: "Q3 Finance — Operating Plan",
      leading: <FileText className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  return (
    <main className="relative h-screen overflow-hidden rounded-xl border border-border-catalog bg-surface-2">
      <div className="pointer-events-none absolute inset-0 opacity-[0.18]">
        <div className="flex h-[46px] items-center gap-2 border-b border-border bg-surface-3 px-4">
          <div className="h-2.5 w-[60px] rounded bg-skeleton-strong" />
          <div className="h-2 w-1.5 rounded-sm bg-skeleton-strong" />
          <div className="h-2.5 w-20 rounded bg-skeleton-strong" />
        </div>
        <div className="flex flex-col gap-2 px-4 py-5">
          <div className="flex h-[34px] items-center gap-2.5 border-b border-border/50 pb-2">
            <div className="h-[9px] w-[54px] rounded bg-skeleton" />
            <div className="h-2.5 flex-1 rounded bg-skeleton" />
            <div className="h-[9px] w-20 rounded bg-skeleton" />
          </div>
          <div className="flex h-[34px] items-center gap-2.5 border-b border-border/50 pb-2">
            <div className="h-[9px] w-[54px] rounded bg-skeleton-muted" />
            <div className="h-2.5 flex-1 rounded bg-skeleton-muted" />
            <div className="h-[9px] w-20 rounded bg-skeleton-muted" />
          </div>
          <div className="flex h-[34px] items-center gap-2.5 pb-2">
            <div className="h-[9px] w-[54px] rounded bg-skeleton-muted" />
            <div className="h-2.5 flex-1 rounded bg-skeleton-muted" />
            <div className="h-[9px] w-20 rounded bg-skeleton-muted" />
          </div>
        </div>
      </div>
      <CommandPalette
        items={visualCommandItems}
        onQueryChange={setQuery}
        open
        presentation="mockup"
        query={query}
      />
    </main>
  );
}

function WorkspaceShell({ userId, userName }: { userId: string; userName: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationLabel = getWorkspaceBreadcrumbSegments(
    location.pathname,
    location.search
  );
  const isBacklogRoute = location.pathname === "/backlog";

  const [themeMode] = useState<ThemeMode>(getInitialThemeMode);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const paletteQueryTerm = paletteQuery.trim();
  const isPaletteSearchReady = paletteQueryTerm.length >= COMMAND_SEARCH_MIN_LENGTH;

  const isDarkMode = themeMode === "dark";

  const utils = trpc.useUtils();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      void navigate("/login", { replace: true });
    },
  });

  const filteredCommands = useMemo(() => {
    const term = paletteQueryTerm.toLowerCase();

    if (term.length === 0) {
      return COMMAND_ITEMS;
    }

    return COMMAND_ITEMS.filter((command) =>
      `${command.label} ${command.meta ?? ""} ${command.group ?? ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [paletteQueryTerm]);

  const globalSearchQuery = trpc.search.global.useQuery(
    { term: paletteQueryTerm, limit: COMMAND_PAGINATED_LIMIT },
    {
      enabled: isPaletteSearchReady,
    }
  );
  const backlogCountQuery = trpc.backlog.count.useQuery();
  const approvalCountQuery = trpc.approval.count.useQuery();

  const sidebarNavCounts = useMemo<Partial<Record<string, number>>>(
    () => ({
      "/backlog": backlogCountQuery.data,
      "/approvals": approvalCountQuery.data,
    }),
    [approvalCountQuery.data, backlogCountQuery.data]
  );

  const commandPaletteItems = useMemo(() => {
    if (!isPaletteSearchReady || !globalSearchQuery.data) {
      return filteredCommands;
    }

    const toGlobalResultItem = ({
      id,
      type,
      path,
      title,
      snippet,
    }: {
      id: string;
      type: keyof typeof searchEntityLabelByType;
      path: string;
      title: string;
      snippet: string;
    }) => ({
      id: `${type.toLowerCase()}-${id}`,
      group: "Search",
      label: title,
      leading:
        type === "TASK" ? (
          <CheckSquare className="h-4 w-4" aria-hidden="true" />
        ) : type === "PAGE" ? (
          <FileText className="h-4 w-4" aria-hidden="true" />
        ) : (
          <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
        ),
      meta: `${searchEntityLabelByType[type]} • ${snippet}`,
      path,
    });

    return [
      ...globalSearchQuery.data.tasks.map((task) =>
        toGlobalResultItem({
          id: task.id,
          type: "TASK",
          path: task.path,
          title: task.title,
          snippet: task.snippet,
        })
      ),
      ...globalSearchQuery.data.pages.map((page) =>
        toGlobalResultItem({
          id: page.id,
          type: "PAGE",
          path: page.path,
          title: page.title,
          snippet: page.snippet,
        })
      ),
      ...globalSearchQuery.data.transactions.map((transaction) =>
        toGlobalResultItem({
          id: transaction.id,
          type: "TRANSACTION",
          path: transaction.path,
          title: transaction.title,
          snippet: transaction.snippet,
        })
      ),
      ...filteredCommands,
    ];
  }, [filteredCommands, globalSearchQuery.data, isPaletteSearchReady]);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    setPaletteQuery("");
  }, []);

  const handleCommandSelect = useCallback(
    (command: CommandItem) => {
      if (command.path) {
        closePalette();
        void navigate(command.path);
        return;
      }

      if (command.id === "new-task") {
        closePalette();
        void navigate("/backlog?new=1");
        return;
      }
    },
    [navigate, closePalette]
  );

  const handleShortcutCommand = useCallback(
    (commandId: string) => {
      const command = COMMAND_ITEMS.find((item) => item.id === commandId);

      if (!command) {
        return;
      }

      handleCommandSelect(command);
    },
    [handleCommandSelect]
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDarkMode);
    localStorage.setItem(THEME_MODE_KEY, themeMode);
  }, [isDarkMode, themeMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const usesCommandModifier = event.metaKey || event.ctrlKey;
      const usesOnlyCommandModifier =
        usesCommandModifier && !event.altKey && !event.shiftKey;
      const isMetaK = usesCommandModifier && event.key.toLowerCase() === "k";

      if (isMetaK) {
        event.preventDefault();
        setPaletteOpen((current) => !current);
        return;
      }

      if (event.key === "Escape") {
        setPaletteOpen(false);
        return;
      }

      if (isEditableKeyboardTarget(event.target)) {
        return;
      }

      const shortcutCommandId = usesOnlyCommandModifier
        ? MODIFIED_NAV_SHORTCUT_COMMAND_ID_BY_KEY[
            event.key as keyof typeof MODIFIED_NAV_SHORTCUT_COMMAND_ID_BY_KEY
          ]
        : !event.altKey && !event.shiftKey
          ? UNMODIFIED_COMMAND_ID_BY_KEY[
              event.key.toLowerCase() as keyof typeof UNMODIFIED_COMMAND_ID_BY_KEY
            ]
          : undefined;

      if (shortcutCommandId) {
        event.preventDefault();
        handleShortcutCommand(shortcutCommandId);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleShortcutCommand]);

  return (
    <WorkspaceShellFrame
      sidebar={
        <>
          <SidebarHeader
            action={
              <ChevronDown
                aria-hidden="true"
                className="h-3.5 w-3.5 text-text-tertiary"
              />
            }
            leading={
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-fg">
                W
              </span>
            }
            title="Wexley Partners"
          />

          <SidebarSearch>
            <Input
              leftSlot={<SearchIcon className="h-4 w-4 text-text-secondary" />}
              rightSlot={<span className="text-xs">⌘K</span>}
              onChange={(event) => {
                setSearchTerm(event.target.value);
              }}
              placeholder="Search"
              size="sm"
              value={searchTerm}
            />
          </SidebarSearch>

          <SidebarNav>
            {NAV_ITEMS.map((route) => {
              return (
                <NavLink
                  className={({ isActive }) =>
                    [
                      sidebarNavItemClassName,
                      isActive
                        ? activeSidebarNavItemClassName
                        : inactiveSidebarNavItemClassName,
                    ].join(" ")
                  }
                  key={route.path}
                  to={route.path}
                >
                  <SidebarNavItemContent
                    icon={route.visualIcon}
                    label={route.label}
                    trailing={
                      sidebarNavCounts[route.path] !== undefined ? (
                        <span className="ml-auto rounded-full bg-surface-1 px-1.5 text-xs font-medium text-accent">
                          {sidebarNavCounts[route.path]}
                        </span>
                      ) : null
                    }
                  />
                </NavLink>
              );
            })}
          </SidebarNav>

          <SidebarFooter>
            <div className="flex items-center gap-2">
              <Avatar name={userName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{userName}</p>
                <p className="truncate text-xs text-text-secondary">Partner</p>
              </div>
              <button
                aria-label="Log out"
                className="rounded px-1 text-xs text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                disabled={logoutMutation.isPending}
                onClick={() => logoutMutation.mutate()}
                type="button"
              >
                ...
              </button>
            </div>
          </SidebarFooter>
        </>
      }
      topbar={
        <TopBar
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                className="hidden md:inline-flex"
                onClick={() => {
                  setPaletteOpen(true);
                }}
                type="button"
              >
                Jump to
                <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-xs">
                  ⌘K
                </span>
              </Button>
              {isBacklogRoute ? (
                <Button
                  size="sm"
                  type="button"
                  onClick={() => {
                    void navigate("/backlog?new=1");
                  }}
                >
                  New task
                  <span className="ml-1 rounded bg-white/15 px-1.5 py-0.5 text-xs">
                    C
                  </span>
                </Button>
              ) : null}
            </>
          }
          breadcrumb={
            <>
              {locationLabel[0]} /{" "}
              <span className="text-text-primary">{locationLabel[1]}</span>
            </>
          }
          mobileTitle="Hibi Portal"
        />
      }
    >
      <CommandPalette
        items={commandPaletteItems}
        onClose={closePalette}
        onSelect={handleCommandSelect}
        onQueryChange={setPaletteQuery}
        open={paletteOpen}
        query={paletteQuery}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/backlog" replace />} />
        <Route
          path="/backlog"
          element={<BacklogPage currentUserId={userId} searchTerm={searchTerm} />}
        />
        <Route path="/approvals" element={<ApprovalsPage currentUserId={userId} />} />
        <Route
          path="/approvals/:id"
          element={<ApprovalsPage currentUserId={userId} />}
        />
        <Route path="/finance" element={<TransactionsPage />} />
        <Route
          path="/docs"
          element={<DocsPage userId={userId} userName={userName} />}
        />
        <Route path="*" element={<Navigate to="/backlog" replace />} />
      </Routes>
    </WorkspaceShellFrame>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("alex@hibi.local");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      void navigate("/backlog", { replace: true });
    },
  });

  const errorMessage = loginMutation.error?.message;

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-1 px-6 py-10 text-text-primary">
      <section className="w-full max-w-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-text-secondary">WMS</p>
          <h1 className="text-2xl font-semibold">Hibi Portal</h1>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            loginMutation.mutate({ email, password });
          }}
        >
          <label className="grid gap-1 text-sm font-medium">
            <span>Email</span>
            <Input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              size="md"
              type="email"
              value={email}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium">
            <span>Password</span>
            <Input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>

          {errorMessage ? (
            <p className="rounded-md border border-status-rejected/30 bg-status-rejected/15 px-3 py-2 text-sm text-status-rejected">
              {errorMessage}
            </p>
          ) : null}

          <Button className="w-full" disabled={loginMutation.isPending} type="submit">
            Log in
          </Button>
        </form>
      </section>
    </main>
  );
}
