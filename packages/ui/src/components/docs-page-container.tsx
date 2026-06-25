import { type KeyboardEvent, type ReactNode, useEffect, useState } from "react";
import { cx } from "../primitives/classnames";

const DEFAULT_EDITOR_HINT =
  "Start typing your content. This shell is ready for a rich editor integration.";
const DEFAULT_PAGE_TITLE = "Untitled page";

export interface DocsPageContainerProps {
  className?: string;
  pagePath: string[];
  pageTitle: string;
  editor?: ReactNode;
  editorPlaceholder?: ReactNode;
  headerActions?: ReactNode;
  editedMeta?: ReactNode;
  sidePanel?: ReactNode;
  onTitleChange: (title: string) => void;
}

export function DocsPageContainer({
  className,
  pagePath,
  pageTitle,
  editor,
  editorPlaceholder = DEFAULT_EDITOR_HINT,
  headerActions,
  editedMeta = "Edited 2h ago by Dev Maddox",
  sidePanel,
  onTitleChange,
}: DocsPageContainerProps) {
  const [titleDraft, setTitleDraft] = useState(pageTitle);

  useEffect(() => {
    setTitleDraft(pageTitle);
  }, [pageTitle]);

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    onTitleChange(trimmed.length === 0 ? DEFAULT_PAGE_TITLE : trimmed);
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTitle();
      event.currentTarget.blur();
    }
  };

  return (
    <main className={cx("flex min-h-0 flex-1 flex-col bg-surface-1", className)}>
      <header className="flex h-[46px] shrink-0 items-center gap-2.5 border-b border-border-subtle px-4">
        <nav
          aria-label="Document path"
          className="flex min-w-0 items-center gap-2 text-xs text-text-muted"
        >
          {pagePath.map((segment, index) => {
            const isLast = index === pagePath.length - 1;

            return (
              <span className="contents" key={`${segment}-${index}`}>
                {index > 0 ? <span className="text-text-tertiary">/</span> : null}
                <span
                  className={cx(
                    "truncate",
                    isLast ? "font-medium text-text-primary" : null
                  )}
                >
                  {segment}
                </span>
              </span>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          {headerActions ?? (
            <span className="inline-flex items-center gap-1 text-xs text-finance-positive">
              <span
                className="h-1.5 w-1.5 rounded-full bg-finance-positive"
                aria-hidden="true"
              />
              Live
            </span>
          )}
        </div>
      </header>
      <section className="flex min-h-0 flex-1 flex-col overflow-auto lg:flex-row">
        <article className="min-w-0 flex-1 px-8 py-10 sm:px-12">
          <div className="max-w-[720px]">
            <p className="text-[11.5px] text-text-tertiary">{editedMeta}</p>
            <input
              aria-label="Edit page title"
              className="mt-5 block w-full bg-transparent text-[30px] font-bold leading-tight text-text-primary outline-none placeholder:text-text-secondary"
              onBlur={commitTitle}
              onChange={(event) => {
                setTitleDraft(event.target.value);
              }}
              onFocus={(event) => {
                event.currentTarget.select();
              }}
              onKeyDown={handleTitleKeyDown}
              placeholder={DEFAULT_PAGE_TITLE}
              type="text"
              value={titleDraft}
            />

            <div className="mt-5 text-sm leading-7 text-text-secondary">
              {editor ? (
                editor
              ) : typeof editorPlaceholder === "string" ? (
                <p>{editorPlaceholder}</p>
              ) : (
                editorPlaceholder
              )}
            </div>
          </div>
        </article>
        {sidePanel ? (
          <aside className="hidden w-[232px] shrink-0 border-l border-border-subtle px-3 py-20 lg:block">
            {sidePanel}
          </aside>
        ) : null}
        {sidePanel ? (
          <div className="border-t border-border-subtle px-4 py-4 lg:hidden">
            {sidePanel}
          </div>
        ) : null}
      </section>
    </main>
  );
}
