import { cx } from "../primitives/classnames";
import {
  DocsPageTree,
  type DocsPageTreeNode,
  type DocsPageTreeProps,
} from "./docs-page-tree";
import { DocsPageContainer, type DocsPageContainerProps } from "./docs-page-container";

type PageTreeProps = Pick<
  DocsPageTreeProps,
  "onCreatePage" | "onMovePage" | "onRenamePage" | "onSelectPage"
>;

export interface DocsShellProps
  extends Omit<DocsPageContainerProps, "className">, PageTreeProps {
  className?: string;
  pages: DocsPageTreeNode[];
  selectedPageId?: string;
}

export function DocsShell({
  className,
  pages,
  selectedPageId,
  onCreatePage,
  onMovePage,
  onRenamePage,
  onSelectPage,
  ...containerProps
}: DocsShellProps) {
  return (
    <section className={cx("flex h-full min-h-0 border border-border", className)}>
      <DocsPageTree
        onCreatePage={onCreatePage}
        onMovePage={onMovePage}
        onRenamePage={onRenamePage}
        onSelectPage={onSelectPage}
        pages={pages}
        selectedPageId={selectedPageId}
      />
      <DocsPageContainer
        pagePath={containerProps.pagePath}
        pageTitle={containerProps.pageTitle}
        editor={containerProps.editor}
        editorPlaceholder={containerProps.editorPlaceholder}
        editedMeta={containerProps.editedMeta}
        headerActions={containerProps.headerActions}
        sidePanel={containerProps.sidePanel}
        onTitleChange={containerProps.onTitleChange}
      />
    </section>
  );
}
