import type { ReactNode } from "react";
import { cx } from "../primitives/classnames";

export interface WorkspaceShellProps {
  children: ReactNode;
  className?: string;
  sidebar: ReactNode;
  topbar: ReactNode;
}

export function WorkspaceShell({
  children,
  className,
  sidebar,
  topbar,
}: WorkspaceShellProps) {
  return (
    <div
      className={cx("relative h-screen overflow-hidden bg-surface-2 text-text-primary", className)}
      data-visual-region="workspace-shell"
    >
      <div className="flex h-full min-w-0">
        <aside
          className="flex w-[228px] shrink-0 flex-col border-r border-border bg-surface-2"
          data-visual-region="workspace-sidebar"
        >
          {sidebar}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col bg-surface-1" data-visual-region="workspace-content">
          {topbar}
          <main className="min-h-0 flex-1 overflow-auto bg-surface-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export interface SidebarHeaderProps {
  action?: ReactNode;
  leading?: ReactNode;
  title: ReactNode;
}

export function SidebarHeader({
  action,
  leading,
  title,
}: SidebarHeaderProps) {
  return (
    <header className="flex h-[46px] shrink-0 items-center justify-between px-3.5">
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
      </div>
      {action}
    </header>
  );
}

export function SidebarSearch({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="px-2.5 pb-2 pt-1">{children}</div>;
}

export function SidebarNav({
  children,
}: {
  children: ReactNode;
}) {
  return <nav className="flex flex-col gap-1 px-2.5 py-1">{children}</nav>;
}

export interface SidebarNavItemContentProps {
  icon?: ReactNode;
  label: ReactNode;
  trailing?: ReactNode;
}

export function SidebarNavItemContent({
  icon,
  label,
  trailing,
}: SidebarNavItemContentProps) {
  return (
    <>
      {icon}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {trailing}
    </>
  );
}

export const sidebarNavItemClassName =
  "group flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/40";

export const activeSidebarNavItemClassName = "bg-accent-subtle text-accent";
export const inactiveSidebarNavItemClassName =
  "text-text-primary hover:bg-surface-3";

export function SidebarFooter({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="mt-auto border-t border-border p-2.5">{children}</div>;
}

export interface TopBarProps {
  actions?: ReactNode;
  breadcrumb: ReactNode;
  mobileTitle?: ReactNode;
}

export function TopBar({
  actions,
  breadcrumb,
  mobileTitle,
}: TopBarProps) {
  return (
    <header
      className="flex h-[46px] shrink-0 items-center gap-3 border-b border-border bg-surface-muted px-3 md:px-4"
      data-visual-region="workspace-topbar"
    >
      <div className="min-w-0">
        <p className="truncate text-xs text-text-secondary">{breadcrumb}</p>
        {mobileTitle ? (
          <p className="hidden truncate text-sm font-semibold">{mobileTitle}</p>
        ) : null}
      </div>
      {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
