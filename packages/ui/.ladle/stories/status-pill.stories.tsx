import "../../tokens/tokens.css";
import { StatusPill } from "../../src";

export const StatusPillLight = () => (
  <div className="min-h-screen bg-surface-1 p-8 text-text-primary">
    <div className="flex max-w-2xl flex-wrap gap-2">
      <StatusPill status="todo" label="Todo" />
      <StatusPill status="in-progress" label="In Progress" />
      <StatusPill status="review" label="In Review" />
      <StatusPill status="done" label="Done" />
      <StatusPill status="blocked" label="Blocked" />
      <StatusPill status="neutral" label="Neutral" />
    </div>
  </div>
);

export const StatusPillDark = () => (
  <div className="dark min-h-screen bg-surface-1 p-8 text-text-primary">
    <div className="flex max-w-2xl flex-wrap gap-2">
      <StatusPill status="todo" label="Todo" />
      <StatusPill status="in-progress" label="In Progress" />
      <StatusPill status="review" label="In Review" />
      <StatusPill status="done" label="Done" />
      <StatusPill status="blocked" label="Blocked" />
      <StatusPill status="neutral" label="Neutral" />
    </div>
  </div>
);
