import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { CircleX, Plus } from "lucide-react";
import {
  AccountTile,
  Button,
  FinanceDashboard,
  type FinanceBudgetRow,
  type FinanceDashboardKpi,
  FinanceTransactionsTable,
  Field,
  type FinanceTransactionsTableRow,
  type FinanceTransactionStatus,
  InlineAlert,
  Input,
  PageFrame,
  Select,
  Tabs,
  type BalanceOverTimePoint,
  type TabItem,
} from "@hibi/ui";
import { trpc } from "@/providers/trpc-provider";

const LIST_LIMIT = 100;
const AMOUNT_INPUT_RE = /^\d+(?:\.\d{1,2})?$/;
const FINANCE_TABS = [
  { value: "overview", label: "Overview" } as const,
  { value: "transactions", label: "Transactions" } as const,
  { value: "budgets", label: "Budgets" } as const,
] satisfies readonly TabItem<FinanceView>[];
const BALANCE_HISTORY_MONTHS = 6;

type TransactionRecord = {
  id: string;
  accountId: string;
  categoryId: string | null;
  amount: unknown;
  currency: string;
  description: string | null;
  status: FinanceTransactionStatus;
  approvalId: string | null;
  occurredAt: string | Date;
  reversedById: string | null;
};

type FormState = {
  accountId: string;
  categoryId: string;
  amount: string;
  date: string;
  description: string;
  isFlagged: boolean;
  reason: string;
};

type RowInput = Omit<FinanceTransactionsTableRow, never>;
type FinanceView = "overview" | "transactions" | "budgets";

type TableAccount = {
  id: string;
  name: string;
  currency: string;
};

type TableCategory = {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
};

type AccountBalance = {
  accountId: string;
  accountName: string;
  currency: string;
  balance: number;
  note: string;
  noteTone: "up" | "down" | "flat";
};

type BudgetVsActualRecord = {
  budgetId: string;
  categoryId: string;
  limit: unknown;
  actual: unknown;
};

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(rawAmount: unknown): number {
  if (typeof rawAmount === "number") {
    return Number.isFinite(rawAmount) ? rawAmount : 0;
  }

  if (typeof rawAmount === "string") {
    const parsed = Number(rawAmount);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (rawAmount && typeof rawAmount === "object") {
    const maybeDecimal = rawAmount as { toNumber?: () => number; toString?: () => string };
    if (typeof maybeDecimal.toNumber === "function") {
      const value = maybeDecimal.toNumber();
      return Number.isFinite(value) ? value : 0;
    }

    const asString = String((maybeDecimal as { toString: () => string }).toString());
    const parsed = Number(asString);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatMoneyCompact(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${currency}`;
  }
}

function formatMoneySigned(amount: number, currency: string) {
  return formatMoney(Math.abs(amount), currency);
}

function getSignedAmount(amount: number, categoryKind: "INCOME" | "EXPENSE" | undefined) {
  if (categoryKind === "EXPENSE") {
    return -Math.abs(amount);
  }

  return Math.abs(amount);
}

function formatDateLabel(value: string | Date) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(timestamp);
}

function createAccountBalanceRows(args: {
  accounts: TableAccount[];
  transactions: TransactionRecord[];
  categoryById: Map<string, TableCategory>;
}): AccountBalance[] {
  const rows = new Map<string, AccountBalance>();

  for (const account of args.accounts) {
    rows.set(account.id, {
      accountId: account.id,
      accountName: account.name,
      currency: account.currency,
      balance: 0,
      note: "No activity",
      noteTone: "flat",
    });
  }

  const postedByAccount = new Map<string, number>();
  const pendingByAccount = new Map<string, number>();

  for (const transaction of args.transactions) {
    const category = transaction.categoryId
      ? args.categoryById.get(transaction.categoryId)
      : undefined;
    const amount = getSignedAmount(toNumber(transaction.amount), category?.kind);

    if (transaction.status === "POSTED") {
      postedByAccount.set(
        transaction.accountId,
        (postedByAccount.get(transaction.accountId) ?? 0) + amount,
      );
    }

    if (transaction.status === "PENDING") {
      pendingByAccount.set(
        transaction.accountId,
        (pendingByAccount.get(transaction.accountId) ?? 0) + amount,
      );
    }
  }

  for (const [accountId, balance] of postedByAccount.entries()) {
    const current = rows.get(accountId);
    if (!current) {
      continue;
    }

    current.balance = balance;
  }

  for (const [accountId, pending] of pendingByAccount.entries()) {
    const current = rows.get(accountId);
    if (!current) {
      continue;
    }

    if (pending > 0) {
      current.note = `+${formatMoneySigned(pending, current.currency)} pending`;
      current.noteTone = "up";
      continue;
    }

    if (pending < 0) {
      current.note = `-${formatMoneySigned(pending * -1, current.currency)} pending`;
      current.noteTone = "down";
      continue;
    }
  }

  return [...rows.values()];
}

function getMonthRange(date = new Date()) {
  const periodStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

  return { periodStart, periodEnd };
}

function getMonthLabel(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  }).format(date);
}

function isInRange(value: string | Date, start: Date, end: Date) {
  const timestamp = new Date(value).getTime();
  return timestamp >= start.getTime() && timestamp <= end.getTime();
}

function createDashboardKpis(args: {
  accountCards: AccountBalance[];
  transactions: TransactionRecord[];
  categoryById: Map<string, TableCategory>;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
}): FinanceDashboardKpi[] {
  const totalBalance = args.accountCards.reduce((sum, account) => sum + account.balance, 0);
  let income = 0;
  let expenses = 0;
  let pendingApproval = 0;
  let pendingItems = 0;

  for (const transaction of args.transactions) {
    const category = transaction.categoryId
      ? args.categoryById.get(transaction.categoryId)
      : undefined;
    const amount = getSignedAmount(toNumber(transaction.amount), category?.kind);

    if (transaction.status === "PENDING") {
      pendingApproval += Math.abs(amount);
      pendingItems += 1;
    }

    if (transaction.status !== "POSTED" || !isInRange(transaction.occurredAt, args.periodStart, args.periodEnd)) {
      continue;
    }

    if (amount >= 0) {
      income += amount;
    } else {
      expenses += Math.abs(amount);
    }
  }

  return [
    {
      label: "Total balance",
      value: formatMoneyCompact(totalBalance, args.currency),
      trend: `${args.accountCards.length} account${args.accountCards.length === 1 ? "" : "s"}`,
      trendDirection: totalBalance >= 0 ? "up" : "down",
    },
    {
      label: "Income · month",
      value: formatMoneyCompact(income, args.currency),
      trend: "Posted this period",
      trendDirection: income > 0 ? "up" : "flat",
    },
    {
      label: "Expenses · month",
      value: formatMoneyCompact(expenses, args.currency),
      trend: "Posted this period",
      trendDirection: expenses > 0 ? "down" : "flat",
    },
    {
      label: "Pending approval",
      value: formatMoneyCompact(pendingApproval, args.currency),
      trend: `${pendingItems} item${pendingItems === 1 ? "" : "s"} awaiting sign-off`,
      trendDirection: pendingItems > 0 ? "down" : "flat",
    },
  ];
}

function createBalancePoints(args: {
  transactions: TransactionRecord[];
  categoryById: Map<string, TableCategory>;
}): BalanceOverTimePoint[] {
  const now = new Date();
  const points: BalanceOverTimePoint[] = [];

  for (let offset = BALANCE_HISTORY_MONTHS - 1; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    const value = args.transactions.reduce((sum, transaction) => {
      if (transaction.status !== "POSTED" || new Date(transaction.occurredAt).getTime() > monthEnd.getTime()) {
        return sum;
      }

      const category = transaction.categoryId
        ? args.categoryById.get(transaction.categoryId)
        : undefined;
      return sum + getSignedAmount(toNumber(transaction.amount), category?.kind);
    }, 0);

    points.push({
      label: new Intl.DateTimeFormat(undefined, { month: "short" }).format(monthDate),
      value,
    });
  }

  return points;
}

function getBalanceChange(points: BalanceOverTimePoint[], currency: string) {
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (!firstPoint || !lastPoint) {
    return undefined;
  }

  const change = lastPoint.value - firstPoint.value;
  if (change === 0) {
    return undefined;
  }

  return `${change > 0 ? "+" : "−"}${formatMoneyCompact(Math.abs(change), currency)}`;
}

function getBalanceChangeDirection(points: BalanceOverTimePoint[]) {
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (!firstPoint || !lastPoint) {
    return "flat";
  }

  if (lastPoint.value > firstPoint.value) {
    return "up";
  }

  if (lastPoint.value < firstPoint.value) {
    return "down";
  }

  return "flat";
}

function createBudgetRows(
  rows: BudgetVsActualRecord[],
  categoryById: Map<string, TableCategory>,
  currency: string,
): FinanceBudgetRow[] {
  return rows.map((row) => {
    const actual = toNumber(row.actual);
    const budget = toNumber(row.limit);
    const deltaAmount = budget === 0 ? 0 : ((actual - budget) / budget) * 100;
    const deltaDirection = deltaAmount > 0 ? "up" : deltaAmount < 0 ? "down" : "flat";
    const deltaPrefix = deltaAmount > 0 ? "+" : deltaAmount < 0 ? "−" : "";

    return {
      id: row.budgetId,
      category: categoryById.get(row.categoryId)?.name ?? row.categoryId,
      actual: formatMoneyCompact(actual, currency),
      budget: formatMoneyCompact(budget, currency),
      delta: `${deltaPrefix}${Math.abs(deltaAmount).toFixed(1)}%`,
      deltaDirection,
    };
  });
}

function toFinanceTransactionRows(
  transactions: TransactionRecord[],
  accountById: Map<string, TableAccount>,
  categoryById: Map<string, TableCategory>,
): RowInput[] {
  return transactions.map((transaction) => {
    const account = accountById.get(transaction.accountId);
    const category = transaction.categoryId
      ? categoryById.get(transaction.categoryId)
      : undefined;
    const signedAmount = getSignedAmount(
      toNumber(transaction.amount),
      category?.kind,
    );

    return {
      id: transaction.id,
      dateLabel: formatDateLabel(transaction.occurredAt),
      description: transaction.description?.trim().length
        ? transaction.description
        : "—",
      category: category?.name ?? "Uncategorized",
      account: account?.name ?? transaction.accountId,
      amount: signedAmount,
      currency: transaction.currency,
      status: transaction.status,
      canReverse: transaction.status === "POSTED" && transaction.reversedById === null,
    };
  });
}

function validateCreateForm(formState: FormState): string | null {
  if (!formState.accountId) {
    return "Select an account.";
  }

  if (!AMOUNT_INPUT_RE.test(formState.amount.trim())) {
    return "Enter a valid amount like 1000.00.";
  }

  const amount = Number(formState.amount);
  if (Number.isNaN(amount) || amount <= 0) {
    return "Amount must be greater than zero.";
  }

  const dateValue = new Date(`${formState.date}T00:00:00`);
  if (Number.isNaN(dateValue.getTime())) {
    return "Select a valid date.";
  }

  if (formState.isFlagged && formState.reason.trim().length === 0) {
    return "Reason is required for a forced approval request.";
  }

  return null;
}

function toCreateDescription(state: FormState) {
  if (state.description.trim().length > 0) {
    return state.description.trim();
  }

  if (state.reason.trim().length > 0) {
    return state.reason.trim();
  }

  return undefined;
}

const EMPTY_FORM: FormState = {
  accountId: "",
  categoryId: "",
  amount: "",
  date: getTodayDateValue(),
  description: "",
  isFlagged: false,
  reason: "",
};

export function TransactionsPage() {
  const utils = trpc.useUtils();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createFormState, setCreateFormState] = useState<FormState>(EMPTY_FORM);
  const activeView = getFinanceView(searchParams.get("view"));
  const { periodStart, periodEnd } = getMonthRange();

  const accountsQuery = trpc.finance.accounts.list.useQuery({ limit: LIST_LIMIT });
  const categoriesQuery = trpc.finance.categories.list.useQuery({ limit: LIST_LIMIT });
  const transactionsQuery = trpc.finance.transactions.list.useQuery({ limit: LIST_LIMIT });
  const budgetReportQuery = trpc.finance.reports.budgetVsActual.useQuery({
    periodStart,
    periodEnd,
  });

  const createTransactionMutation = trpc.finance.transactions.create.useMutation({
    onSuccess: async () => {
      setIsCreateOpen(false);
      setCreateFormState({
        ...EMPTY_FORM,
        date: getTodayDateValue(),
      });
      await utils.finance.transactions.list.invalidate();
    },
  });

  const reverseTransactionMutation = trpc.finance.transactions.reverse.useMutation({
    onSuccess: async () => {
      await utils.finance.transactions.list.invalidate();
    },
  });

  const normalizedSearchTerm = (searchParams.get("search") ?? "")
    .trim()
    .toLowerCase();

  const accountById = useMemo(() => {
    const map = new Map<string, TableAccount>();
    for (const account of accountsQuery.data?.items ?? []) {
      map.set(account.id, {
        id: account.id,
        currency: account.currency,
        name: account.name,
      });
    }

    return map;
  }, [accountsQuery.data]);

  const categoryById = useMemo(() => {
    const map = new Map<string, TableCategory>();
    for (const category of categoriesQuery.data?.items ?? []) {
      map.set(category.id, {
        id: category.id,
        name: category.name,
        kind: category.kind,
      });
    }

    return map;
  }, [categoriesQuery.data]);

  const transactionRows = useMemo(() => {
    const rows =
      (transactionsQuery.data?.items as TransactionRecord[] | undefined) ?? [];
    const searchableRows =
      normalizedSearchTerm.length === 0
        ? rows
        : rows.filter((transaction) => {
            const searchTarget =
              `${transaction.description ?? ""} ${transaction.accountId} ${transaction.categoryId ?? ""}`.toLowerCase();
            return searchTarget.includes(normalizedSearchTerm);
          });

    return toFinanceTransactionRows(searchableRows, accountById, categoryById);
  }, [transactionsQuery.data?.items, normalizedSearchTerm, accountById, categoryById]);

  const accountCards = useMemo(() => {
    const accounts =
      (accountsQuery.data?.items as TableAccount[] | undefined) ?? [];
    const transactions =
      (transactionsQuery.data?.items as TransactionRecord[] | undefined) ?? [];

    return createAccountBalanceRows({
      accounts,
      categoryById,
      transactions,
    });
  }, [accountsQuery.data?.items, categoryById, transactionsQuery.data?.items]);

  const dashboardTransactions =
    (transactionsQuery.data?.items as TransactionRecord[] | undefined) ?? [];
  const dashboardCurrency = accountCards[0]?.currency ?? "USD";
  const dashboardKpis = useMemo(
    () =>
      createDashboardKpis({
        accountCards,
        categoryById,
        currency: dashboardCurrency,
        periodEnd,
        periodStart,
        transactions: dashboardTransactions,
      }),
    [accountCards, categoryById, dashboardCurrency, dashboardTransactions, periodEnd, periodStart],
  );
  const balancePoints = useMemo(
    () =>
      createBalancePoints({
        categoryById,
        transactions: dashboardTransactions,
      }),
    [categoryById, dashboardTransactions],
  );
  const budgetRows = useMemo(
    () =>
      createBudgetRows(
        (budgetReportQuery.data?.items as BudgetVsActualRecord[] | undefined) ?? [],
        categoryById,
        dashboardCurrency,
      ),
    [budgetReportQuery.data?.items, categoryById, dashboardCurrency],
  );

  const createError = useMemo(
    () => validateCreateForm(createFormState),
    [createFormState],
  );

  const readErrorMessages = [
    accountsQuery.error?.message
      ? `Failed to load accounts: ${accountsQuery.error.message}`
      : null,
    categoriesQuery.error?.message
      ? `Failed to load categories: ${categoriesQuery.error.message}`
      : null,
    transactionsQuery.error?.message
      ? `Failed to load transactions: ${transactionsQuery.error.message}`
      : null,
    budgetReportQuery.error?.message
      ? `Failed to load budget report: ${budgetReportQuery.error.message}`
      : null,
  ];
  const readError = readErrorMessages.find(Boolean);

  const createErrorMessage = createTransactionMutation.error?.message
    ? `Failed to create transaction: ${createTransactionMutation.error.message}`
    : null;
  const reverseErrorMessage = reverseTransactionMutation.error?.message
    ? `Failed to reverse transaction: ${reverseTransactionMutation.error.message}`
    : null;

  const isDataLoading =
    accountsQuery.isLoading ||
    categoriesQuery.isLoading ||
    transactionsQuery.isLoading ||
    budgetReportQuery.isLoading;

  const isMutating =
    createTransactionMutation.isPending || reverseTransactionMutation.isPending;
  const isLoading = isDataLoading || isMutating;

  const hasNoTransactions =
    !isLoading &&
    !readError &&
    (transactionsQuery.data?.items?.length ?? 0) === 0;

  const handleRetryRead = () => {
    void accountsQuery.refetch();
    void categoriesQuery.refetch();
    void transactionsQuery.refetch();
    void budgetReportQuery.refetch();
  };

  return (
    <PageFrame className="gap-0" maxWidth="full" style={{ gap: 0 }}>
      <Tabs
        className="bg-surface-1"
        items={FINANCE_TABS}
        listClassName="h-[38px] gap-5 px-4"
        onChange={(nextView) => {
          setSearchParams((current) => {
            const nextParams = new URLSearchParams(current);
            if (nextView === "overview") {
              nextParams.delete("view");
            } else {
              nextParams.set("view", nextView);
            }
            return nextParams;
          });
        }}
        tabClassName="flex h-[38px] items-center border-b-2 px-0 pb-0 pt-0 text-[13px]"
        value={activeView}
      />

      {readError ? (
        <InlineAlert tone="error" className="flex items-center justify-between gap-2">
          <span>{readError}</span>
          <Button
            onClick={handleRetryRead}
            size="sm"
            variant="outline"
            type="button"
          >
            Retry
          </Button>
        </InlineAlert>
      ) : null}

      {isDataLoading ? (
        <InlineAlert>Loading finance data…</InlineAlert>
      ) : null}

      {activeView === "overview" ? (
        <FinanceDashboard
          balanceChange={getBalanceChange(balancePoints, dashboardCurrency)}
          balanceChangeDirection={getBalanceChangeDirection(balancePoints)}
          balancePoints={balancePoints}
          budgetRows={budgetRows}
          isLoading={isLoading}
          kpis={dashboardKpis}
          periodLabel={getMonthLabel()}
        />
      ) : null}

      {activeView !== "overview" ? (
        <div className="rounded-md border border-border bg-surface-1 p-3">
        <div className="mb-3 flex justify-end">
          <Button
            leftSlot={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={() => {
              setIsCreateOpen((current) => !current);
            }}
            size="sm"
            variant="outline"
            type="button"
          >
            New transaction
          </Button>
        </div>
        <div className="mb-2 grid gap-2 text-xs text-text-secondary sm:grid-cols-3 lg:grid-cols-5">
          <button className="rounded border border-border px-2 py-1" type="button">
            Jun 1 – Jun 17
          </button>
          <button className="rounded border border-border px-2 py-1" type="button">
            Account
          </button>
          <button className="rounded border border-border px-2 py-1" type="button">
            Category
          </button>
          <p className="justify-self-end text-right font-medium tabular-nums text-text-primary">
            {transactionRows.length} transactions
          </p>
          <button className="rounded border border-border px-2 py-1" type="button">
            Sort
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {accountCards.map((account) => (
            <AccountTile
              key={account.accountId}
              accountName={account.accountName}
              balance={account.balance}
              currency={account.currency}
              trend={account.note}
              trendDirection={account.noteTone}
            />
          ))}
        </div>
      </div>
      ) : null}

      {isCreateOpen ? (
        <form
          className="rounded-md border border-border bg-surface-1 p-3"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();

            if (createError !== null || createTransactionMutation.isPending) {
              return;
            }

            createTransactionMutation.mutate({
              accountId: createFormState.accountId,
              categoryId: createFormState.categoryId || undefined,
              amount: Number(createFormState.amount).toFixed(2),
              isFlagged: createFormState.isFlagged,
              reason: toCreateDescription(createFormState),
              occurredAt: new Date(`${createFormState.date}T00:00:00`),
            });
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Create transaction</h3>
            <button
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-3"
              onClick={() => {
                setIsCreateOpen(false);
                setCreateFormState({
                  ...EMPTY_FORM,
                  date: getTodayDateValue(),
                });
              }}
              type="button"
            >
              <CircleX className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Field label="Account">
              <Select
                className="w-full"
                onChange={(event) => {
                  setCreateFormState((current) => ({
                    ...current,
                    accountId: event.target.value,
                  }));
                }}
                size="sm"
                value={createFormState.accountId}
              >
                <option value="">Select account</option>
                {Array.from(accountById.values()).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Category">
              <Select
                className="w-full"
                onChange={(event) => {
                  setCreateFormState((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }));
                }}
                size="sm"
                value={createFormState.categoryId}
              >
                <option value="">Uncategorized</option>
                {Array.from(categoryById.values()).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Amount">
              <Input
                onChange={(event) => {
                  setCreateFormState((current) => ({
                    ...current,
                    amount: event.target.value,
                  }));
                }}
                placeholder="1500.00"
                type="text"
                value={createFormState.amount}
              />
            </Field>

            <Field label="Date">
              <Input
                onChange={(event) => {
                  setCreateFormState((current) => ({
                    ...current,
                    date: event.target.value,
                  }));
                }}
                size="sm"
                type="date"
                value={createFormState.date}
              />
            </Field>

            <Field className="lg:col-span-2" label="Description">
              <Input
                onChange={(event) => {
                  setCreateFormState((current) => ({
                    ...current,
                    description: event.target.value,
                  }));
                }}
                placeholder="Memo"
                value={createFormState.description}
              />
            </Field>

            <label className="col-span-full flex items-center gap-2 text-sm">
              <input
                checked={createFormState.isFlagged}
                onChange={(event) => {
                  setCreateFormState((current) => ({
                    ...current,
                    isFlagged: event.target.checked,
                  }));
                }}
                type="checkbox"
              />
              <span>Force approval request</span>
            </label>

            {createFormState.isFlagged ? (
              <Field className="col-span-full" label="Reason">
                <Input
                  onChange={(event) => {
                    setCreateFormState((current) => ({
                      ...current,
                      reason: event.target.value,
                    }));
                  }}
                  placeholder="Explain why this must be approved"
                  value={createFormState.reason}
                />
              </Field>
            ) : null}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-text-secondary">
              New entries are created as PENDING and only become POSTED after approval.
            </p>
            <Button
              disabled={Boolean(createError) || createTransactionMutation.isPending}
              type="submit"
            >
              {createTransactionMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </div>

          {createError ? <InlineAlert className="mt-2" tone="error">{createError}</InlineAlert> : null}
          {createErrorMessage ? (
            <InlineAlert className="mt-2" tone="error">
              <span className="mr-2">{createErrorMessage}</span>
              <Button
                onClick={() => {
                  createTransactionMutation.reset();
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Retry
              </Button>
            </InlineAlert>
          ) : null}
        </form>
      ) : null}

      {activeView === "budgets" ? (
        <FinanceDashboard
          balancePoints={[]}
          budgetRows={budgetRows}
          isLoading={isLoading}
          kpis={[]}
          periodLabel={getMonthLabel()}
          showBalanceChart={false}
          showKpis={false}
        />
      ) : null}

      {activeView === "transactions" ? (
        <>
          {reverseErrorMessage ? (
            <InlineAlert className="mb-2" tone="error">
              <span className="mr-2">{reverseErrorMessage}</span>
              <Button
                onClick={() => {
                  reverseTransactionMutation.reset();
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Retry
              </Button>
            </InlineAlert>
          ) : null}
          <FinanceTransactionsTable
            onReverse={(row) => {
              const reason = window.prompt("Reason for reversal");
              if (!reason || reason.trim().length === 0) {
                return;
              }

              reverseTransactionMutation.mutate({
                id: row.id,
                reason: reason.trim(),
              });
            }}
            rows={transactionRows}
            reversingTransactionId={
              reverseTransactionMutation.variables
                ? reverseTransactionMutation.variables.id
                : null
            }
            rowClassName={(row) =>
              row.status === "PENDING"
                ? "bg-status-pending/12 hover:bg-status-pending/18"
                : row.status === "REVERSED"
                  ? "opacity-55 text-text-secondary"
                  : ""
            }
          />
          {hasNoTransactions ? (
            <InlineAlert className="mt-2">
              No transactions found. Try creating one to start tracking cash flow.
            </InlineAlert>
          ) : null}
        </>
      ) : null}
    </PageFrame>
  );
}

function getFinanceView(value: string | null): FinanceView {
  if (value === "transactions" || value === "budgets") {
    return value;
  }

  return "overview";
}
