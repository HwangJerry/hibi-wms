import { trpc } from "@/providers/trpc-provider";

export function HealthStatus() {
  const healthQuery = trpc.health.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const status = (() => {
    if (healthQuery.isSuccess && healthQuery.data.status === "ok") {
      return {
        label: "API healthy",
        indicatorClassName: "bg-emerald-500",
      };
    }

    if (healthQuery.isError) {
      return {
        label: "API unavailable",
        indicatorClassName: "bg-destructive",
      };
    }

    return {
      label: "Checking API",
      indicatorClassName: "bg-muted-foreground",
    };
  })();

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
      <span
        className={["h-2 w-2 rounded-full", status.indicatorClassName].join(" ")}
        aria-hidden="true"
      />
      {status.label}
    </div>
  );
}
