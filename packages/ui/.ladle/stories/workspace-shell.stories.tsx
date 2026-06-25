import { Bell, ListChecks, Search, SunMoon } from "lucide-react";
import "../../tokens/tokens.css";
import {
  activeSidebarNavItemClassName,
  Avatar,
  Button,
  inactiveSidebarNavItemClassName,
  Input,
  PageFrame,
  PageHeader,
  SidebarFooter,
  SidebarHeader,
  SidebarNav,
  SidebarNavItemContent,
  SidebarSearch,
  sidebarNavItemClassName,
  TopBar,
  WorkspaceShell,
} from "../../src";

function WorkspaceShellStory({ dark = false }: { dark?: boolean }) {
  return (
    <div className={dark ? "dark" : undefined}>
      <WorkspaceShell
        sidebar={
          <>
            <SidebarHeader
              action={
                <Button aria-label="Theme mode" size="sm" variant="ghost">
                  <SunMoon className="h-4 w-4" aria-hidden="true" />
                </Button>
              }
              title="Hibi Portal"
            />
            <SidebarSearch>
              <Input
                leftSlot={<Search className="h-4 w-4 text-text-secondary" aria-hidden="true" />}
                placeholder="Search"
                rightSlot={<span className="text-[10px]">⌘K</span>}
                size="sm"
              />
            </SidebarSearch>
            <SidebarNav>
              <a className={`${sidebarNavItemClassName} ${activeSidebarNavItemClassName}`} href="#backlog">
                <SidebarNavItemContent
                  icon={<ListChecks className="h-3.5 w-3.5" aria-hidden="true" />}
                  label="Backlog"
                />
              </a>
              <a className={`${sidebarNavItemClassName} ${inactiveSidebarNavItemClassName}`} href="#docs">
                <SidebarNavItemContent label="Docs" />
              </a>
            </SidebarNav>
            <SidebarFooter>
              <div className="flex items-center gap-2">
                <Avatar name="Jerry" size="sm" />
                <p className="truncate text-sm font-medium">Jerry</p>
              </div>
            </SidebarFooter>
          </>
        }
        topbar={
          <TopBar
            actions={
              <Button size="sm" variant="outline">
                <Bell className="h-4 w-4" aria-hidden="true" />
              </Button>
            }
            breadcrumb={
              <>
                Workspace / <span className="text-text-primary">Backlog</span>
              </>
            }
            mobileTitle="Hibi Portal"
          />
        }
      >
        <PageFrame>
          <PageHeader meta="42 tasks" title="Backlog" />
        </PageFrame>
      </WorkspaceShell>
    </div>
  );
}

export const WorkspaceShellLight = () => <WorkspaceShellStory />;
export const WorkspaceShellDark = () => <WorkspaceShellStory dark />;
