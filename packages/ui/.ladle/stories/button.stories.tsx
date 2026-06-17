import "../tokens/tokens.css";
import { Button } from "../src";

export const ButtonLight = () => (
  <div className="min-h-screen bg-surface-1 p-8 text-text-primary">
    <div className="flex max-w-2xl flex-wrap gap-3">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="secondary" size="sm">
        Small
      </Button>
      <Button size="lg" rightSlot="C">
        Create
      </Button>
    </div>
  </div>
);

export const ButtonDark = () => (
  <div className="dark min-h-screen bg-surface-1 p-8 text-text-primary">
    <div className="flex max-w-2xl flex-wrap gap-3">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="secondary" size="sm">
        Small
      </Button>
      <Button size="lg" rightSlot="C">
        Create
      </Button>
    </div>
  </div>
);
