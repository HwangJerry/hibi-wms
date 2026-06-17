import { FileText, ListChecks, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Button } from "./components/ui/button";
import { HealthStatus } from "./components/health-status";
import { BacklogPage } from "./features/backlog/backlog-page";
import { trpc } from "./providers/trpc-provider";

const routes = [
  {
    path: "/backlog",
    label: "Backlog",
    icon: ListChecks,
  },
  {
    path: "/docs",
    label: "Docs",
    icon: FileText,
  },
] as const;

export function App() {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
  });

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-sm text-muted-foreground">
        Loading workspace
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          meQuery.isSuccess ? (
            <Navigate to="/backlog" replace />
          ) : (
            <LoginPage />
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

function WorkspaceShell({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      void navigate("/login", { replace: true });
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
        <aside className="border-b bg-muted/30 px-4 py-5 md:border-b-0 md:border-r">
          <div className="mb-5 md:mb-8">
            <p className="text-sm font-medium text-muted-foreground">WMS</p>
            <h1 className="text-xl font-semibold tracking-normal">Hibi Portal</h1>
          </div>

          <nav className="flex gap-1 md:block md:space-y-1">
            {routes.map((route) => {
              const Icon = route.icon;

              return (
                <NavLink
                  className={({ isActive }) =>
                    [
                      "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    ].join(" ")
                  }
                  key={route.path}
                  to={route.path}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {route.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
            <div>
              <p className="text-sm font-medium">Workspace</p>
              <p className="text-xs text-muted-foreground">{userName}</p>
            </div>
            <div className="flex items-center gap-2">
              <HealthStatus />
              <Button
                aria-label="Log out"
                disabled={logoutMutation.isPending}
                onClick={() => logoutMutation.mutate()}
                size="icon"
                type="button"
                variant="outline"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </header>

          <main className="flex-1 px-6 py-6">
            <Routes>
              <Route path="/" element={<Navigate to="/backlog" replace />} />
              <Route
                path="/backlog"
                element={<BacklogPage currentUserId={userId} />}
              />
              <Route
                path="/docs"
                element={
                  <PlaceholderPage
                    title="Docs"
                    description="Collaborative documents will live here."
                  />
                }
              />
              <Route path="*" element={<Navigate to="/backlog" replace />} />
            </Routes>
          </main>
        </div>
      </div>
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
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-muted-foreground">WMS</p>
          <h1 className="text-2xl font-semibold tracking-normal">Hibi Portal</h1>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            loginMutation.mutate({ email, password });
          }}
        >
          <label className="block space-y-2 text-sm font-medium">
            <span>Email</span>
            <input
              autoComplete="email"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>

          <label className="block space-y-2 text-sm font-medium">
            <span>Password</span>
            <input
              autoComplete="current-password"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>

          {errorMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
      <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </section>
  );
}
