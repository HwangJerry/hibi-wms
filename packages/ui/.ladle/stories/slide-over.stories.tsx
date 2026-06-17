import { useState } from "react";
import "../tokens/tokens.css";
import { Button, SlideOver } from "../src";

function SlideOverDemo({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={dark ? "dark relative min-h-[360px] bg-surface-1 p-8" : "relative min-h-[360px] bg-surface-1 p-8"}>
      <Button onClick={() => setOpen(true)}>Open panel →</Button>
      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Reconcile Q2 vendor invoices"
        primaryActionLabel="Mark for Review"
        secondaryActionLabel="Comment"
      >
        <p className="text-sm text-text-secondary">
          Match all 14 vendor invoices against the Q2 ledger and flag any discrepancy over
          $500 for sign-off.
        </p>
      </SlideOver>
    </div>
  );
}

export const SlideOverLight = () => <SlideOverDemo />;
export const SlideOverDark = () => <SlideOverDemo dark />;
