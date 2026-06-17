import "../tokens/tokens.css";
import { DenseTextarea, Input } from "../src";

export const InputLight = () => (
  <div className="min-h-screen bg-surface-1 p-8 text-text-primary">
    <div className="flex max-w-xl flex-col gap-4">
      <Input defaultValue="Search tasks…" />
      <Input defaultValue="Filter by assignee" className="w-56" />
      <DenseTextarea rows={3} defaultValue="Description placeholder" />
    </div>
  </div>
);

export const InputDark = () => (
  <div className="dark min-h-screen bg-surface-1 p-8 text-text-primary">
    <div className="flex max-w-xl flex-col gap-4">
      <Input defaultValue="Search tasks…" />
      <Input defaultValue="Filter by assignee" className="w-56" />
      <DenseTextarea rows={3} defaultValue="Description placeholder" />
    </div>
  </div>
);
