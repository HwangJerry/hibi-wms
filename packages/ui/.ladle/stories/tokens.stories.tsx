import "../tokens/tokens.css";

export const SurfaceTokens = () => {
  return (
    <section className="min-h-screen bg-surface-1 p-8 text-text-primary">
      <h2 className="mb-4 text-2xl font-semibold">Surface and text tokens</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-md border border-border bg-surface-2 p-4">
          <p className="text-sm text-text-secondary">surface-1</p>
          <p className="mt-2 text-lg font-semibold">--surface-1</p>
        </article>
        <article className="rounded-md border border-border bg-surface-2 p-4">
          <p className="text-sm text-text-secondary">surface-2</p>
          <p className="mt-2 text-lg font-semibold">--surface-2</p>
        </article>
        <article className="rounded-md border border-border bg-surface-2 p-4">
          <p className="text-sm text-text-secondary">surface-3</p>
          <p className="mt-2 text-lg font-semibold">--surface-3</p>
        </article>
      </div>
    </section>
  );
};

export const StatusAndAccent = () => {
  return (
    <div className="dark min-h-screen bg-surface-1 p-8 text-text-primary">
      <h2 className="mb-4 text-2xl font-semibold">Status and accent tokens</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-md border border-border bg-surface-2 p-4">
          <p className="text-sm text-text-secondary">accent</p>
          <p className="mt-2 text-lg font-semibold" style={{ color: "var(--accent)" }}>
            --accent
          </p>
          <button
            className="mt-3 inline-flex rounded-md bg-accent px-3 py-2 text-accent-fg"
            type="button"
          >
            Accent button
          </button>
        </article>
        <article className="rounded-md border border-border bg-surface-2 p-4">
          <p className="text-sm text-text-secondary">Status</p>
          <ul className="mt-2 space-y-2">
            <li className="rounded bg-status-pending px-2 py-1 text-sm text-text-primary">
              --status-pending
            </li>
            <li className="rounded bg-status-approved px-2 py-1 text-sm text-text-primary">
              --status-approved
            </li>
            <li className="rounded bg-status-rejected px-2 py-1 text-sm text-text-primary">
              --status-rejected
            </li>
            <li className="rounded bg-status-done px-2 py-1 text-sm text-text-primary">--status-done</li>
          </ul>
        </article>
      </div>
    </div>
  );
};
