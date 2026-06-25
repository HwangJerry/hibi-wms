import "../../tokens/tokens.css";
import { Button, Field, InlineAlert, Input, PageFrame, PageHeader, Select, SegmentedControl, Toolbar } from "../../src";

function PageLayoutStory({ dark = false }: { dark?: boolean }) {
  return (
    <div className={dark ? "dark min-h-screen bg-surface-2 p-6" : "min-h-screen bg-surface-2 p-6"}>
      <PageFrame>
        <PageHeader
          actions={<Button size="sm">New task</Button>}
          meta="42 tasks"
          title="Backlog"
        />

        <Toolbar
          trailing={
            <SegmentedControl
              ariaLabel="View mode"
              onValueChange={() => {
                void 0;
              }}
              options={[
                { label: "List", value: "list" },
                { label: "Board", value: "board" },
              ]}
              value="list"
            />
          }
        >
          <Field label="Status">
            <Select size="sm">
              <option>All statuses</option>
              <option>Todo</option>
            </Select>
          </Field>
          <Field label="Search" className="min-w-64 flex-1">
            <Input placeholder="Title or description" size="sm" />
          </Field>
        </Toolbar>

        <InlineAlert tone="error">A request failed. Try again.</InlineAlert>
      </PageFrame>
    </div>
  );
}

export const PageLayoutLight = () => <PageLayoutStory />;
export const PageLayoutDark = () => <PageLayoutStory dark />;
