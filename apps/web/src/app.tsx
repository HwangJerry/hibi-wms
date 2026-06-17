import {
  CheckSquare,
  CircleDollarSign,
  FileText,
  ListChecks,
  LogOut,
  Search as SearchIcon,
  SunMoon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  CommandPalette,
  Input,
  type CommandItem,
} from "@hibi/ui";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BacklogPage } from "./features/backlog/backlog-page";
import { trpc } from "./providers/trpc-provider";

type ThemeMode = "light" | "dark";

const THEME_MODE_KEY = "hibi-theme-mode";

const APPROVALS_PENDING = 4;

type NavItem = {
  label: string;
  path: string;
  icon: typeof ListChecks;
  badge?: number;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Backlog",
    path: "/backlog",
    icon: ListChecks,
  },
  {
    label: "Approvals",
    path: "/approvals",
    icon: CheckSquare,
    badge: APPROVALS_PENDING,
  },
  {
    label: "Finance",
    path: "/finance",
    icon: CircleDollarSign,
  },
  {
    label: "Docs",
    path: "/docs",
    icon: FileText,
  },
] ;

type WorkspaceRoute = (typeof NAV_ITEMS)[number]["path"];

type ThemeStorageMode = ThemeMode | null;

const COMMAND_ITEMS: CommandItem[] = [
  {
    id: "goto-backlog",
    group: "Navigate",
    label: "Go to Backlog",
    shortcut: "⌘1",
    meta: "/backlog",
  },
  {
    id: "goto-approvals",
    group: "Navigate",
    label: "Go to Approvals",
    shortcut: "⌘2",
    meta: "/approvals",
  },
  {
    id: "goto-finance",
    group: "Navigate",
    label: "Go to Finance",
    shortcut: "⌘3",
    meta: "/finance",
  },
  {
    id: "goto-docs",
    group: "Navigate",
    label: "Go to Docs",
    shortcut: "⌘4",
    meta: "/docs",
  },
  {
    id: "new-task",
    group: "Create",
    label: "Create new task",
    shortcut: "C",
  },
];

const COMMAND_ROUTES: Record<string, string> = {
  "goto-backlog": "/backlog",
  "goto-approvals": "/approvals",
  "goto-finance": "/finance",
  "goto-docs": "/docs",
};

const NAV_LABEL_BY_PATH = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.path, item.label]),
) as Record<WorkspaceRoute, string>;

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

function getBreadcrumbSegments(pathname: string): string[] {
  const routeLabel = NAV_LABEL_BY_PATH[pathname as WorkspaceRoute];

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

export function App() {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
  });
  const isUnauthorized =
    meQuery.error?.data?.code === "UNAUTHORIZED" && !meQuery.isLoading;

  if (isUnauthorized) {
    return <Navigate to="/login" replace />;
  }

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
        element={
          meQuery.isSuccess ? <Navigate to="/backlog" replace /> : <LoginPage />
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

function WorkspaceShell({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationLabel = getBreadcrumbSegments(location.pathname);

  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const isDarkMode = themeMode === "dark";

  const utils = trpc.useUtils();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      void navigate("/login", { replace: true });
    },
  });

  const filteredCommands = useMemo(() => {
    const term = paletteQuery.trim().toLowerCase();

    if (term.length === 0) {
      return COMMAND_ITEMS;
    }

    return COMMAND_ITEMS.filter((command) =>
      `${command.label} ${command.meta ?? ""} ${command.group ?? ""}`.toLowerCase().includes(term),
    );
  }, [paletteQuery]);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    setPaletteQuery("");
  }, []);

  const handleCommandSelect = useCallback(
    (command: CommandItem) => {
      if (command.id === "new-task") {
        closePalette();
        void navigate("/backlog");
        return;
      }

      const nextPath = COMMAND_ROUTES[command.id];
      if (nextPath) {
        closePalette();
        void navigate(nextPath);
      }
    },
    [navigate, closePalette],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDarkMode);
    localStorage.setItem(THEME_MODE_KEY, themeMode);
  }, [isDarkMode, themeMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMetaK =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

      if (isMetaK) {
        event.preventDefault();
        setPaletteOpen((current) => !current);
        return;
      }

      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-surface-1 text-text-primary">
      <CommandPalette
        items={filteredCommands}
        onClose={closePalette}
        onSelect={handleCommandSelect}
        onQueryChange={setPaletteQuery}
        open={paletteOpen}
        query={paletteQuery}
      />

      <div className="grid min-h-screen gap-0 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="flex h-full flex-col border-b border-border/80 bg-surface-2 px-3 py-4 md:border-r md:border-b-0">
          <header className="mb-4 flex items-center justify-between px-1">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-text-secondary">
                WMS
              </p>
              <p className="text-sm font-semibold">Hibi Portal</p>
            </div>
            <Button
              aria-label="Theme mode"
              onClick={() => setThemeMode(isDarkMode ? "light" : "dark")}
              size="sm"
              variant="ghost"
              type="button"
            >
              <SunMoon aria-hidden="true" className="h-4 w-4" />
            </Button>
          </header>

          <div className="mb-4 space-y-1 px-1">
            <Input
              leftSlot={<SearchIcon className="h-4 w-4 text-text-secondary" />}
              onChange={(event) => {
                setSearchTerm(event.target.value);
              }}
              placeholder="Search"
              size="sm"
              value={searchTerm}
            />
            <div className="mt-1 flex items-center justify-between px-1 text-[11px] text-text-secondary">
              <span>Press</span>
              <span className="rounded border border-border px-1.5 py-0.5">
                ⌘K
              </span>
            </div>
          </div>

          <nav className="flex flex-col gap-1 px-1">
            {NAV_ITEMS.map((route) => {
              const Icon = route.icon;
              return (
                <NavLink
                  className={({ isActive }) =>
                    [
                      "flex h-10 items-center gap-2 rounded-md px-2 text-sm font-medium",
                      isActive
                        ? "bg-accent text-accent-fg"
                        : "text-text-secondary hover:bg-surface-3",
                    ].join(" ")
                  }
                  key={route.path}
                  to={route.path}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="flex-1">{route.label}</span>
                  {route.badge ? (
                    <span className="rounded border border-accent/60 bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent">
                      {route.badge}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-border pt-3">
            <div className="flex items-center gap-2 px-1 py-2">
              <Avatar name={userName} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{userName}</p>
                <p className="truncate text-xs text-text-secondary">Partner</p>
              </div>
            </div>
            <p className="text-xs text-text-secondary">ID: {userId}</p>
            <Button
              aria-label="Log out"
              className="mt-2 w-full justify-start"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
              size="sm"
              variant="outline"
              type="button"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="flex min-h-11 shrink-0 items-center gap-3 border-b border-border px-4 py-2">
            <p className="text-sm">
              <span className="text-text-secondary">{locationLabel[0]}</span>
              <span className="text-text-secondary/80"> / </span>
              <span className="font-medium">{locationLabel[1]}</span>
            </p>

            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPaletteOpen(true);
                }}
                type="button"
              >
                Jump to
                <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[11px]">
                  ⌘K
                </span>
              </Button>
              <ApiHealthBadge />
            </div>
          </header>

              <main className="flex-1 overflow-hidden p-4">
            <Routes>
              <Route
                path="/"
                element={<Navigate to="/backlog" replace />}
              />
              <Route
                path="/backlog"
                element={
                  <BacklogPage
                    currentUserId={userId}
                    searchTerm={searchTerm}
                  />
                }
              />
              <Route
                path="/approvals"
                element={<PlaceholderPage title="Approvals" description="Review and process approvals." />}
              />
              <Route
                path="/finance"
                element={<PlaceholderPage title="Finance" description="Track budgets and transactions." />}
              />
              <Route
                path="/docs"
                element={<PlaceholderPage title="Docs" description="Collaborative documents live here." />}
              />
              <Route path="*" element={<Navigate to="/backlog" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

function ApiHealthBadge() {
  const healthQuery = trpc.health.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const status = useMemo(() => {
    if (healthQuery.isLoading) {
      return {
        label: "Checking API",
        indicatorClassName: "bg-text-secondary",
      };
    }

    if (healthQuery.isError || healthQuery.data?.status !== "ok") {
      return {
        label: "API unavailable",
        indicatorClassName: "bg-status-rejected",
      };
    }

    return {
      label: "API healthy",
      indicatorClassName: "bg-status-approved",
    };
  }, [healthQuery.data?.status, healthQuery.isError, healthQuery.isLoading]);

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary">
      <span
        aria-hidden="true"
        className={[
          "h-2 w-2 rounded-full",
          status.indicatorClassName,
        ].join(" ")}
      />
      {status.label}
    </div>
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

          <Button
            className="w-full"
            disabled={loginMutation.isPending}
            type="submit"
          >
            Log in
          </Button>
        </form>
      </section>
    </main>
  );
}

function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: ReactNode;
}) {
  return (
    <section className="max-w-3xl">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
    </section>
  );
}
