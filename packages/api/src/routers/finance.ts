import { Prisma } from "@hibi/db";
import { z } from "zod";
import { createFinanceService } from "../modules/finance/index.js";
import { protectedProcedure, router } from "../trpc.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

const idSchema = z.string().trim().min(1);
const dateSchema = z.coerce.date();
const currencySchema = z.string().trim().length(3);
const decimalSchema = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/)
  .brand("DecimalString");

const accountKindValues = ["CASH", "BANK", "CARD", "OTHER"] as const;
const categoryKindValues = ["INCOME", "EXPENSE"] as const;

const listInputSchema = z.object({
  cursor: idSchema.optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
});

const createAccountInputSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(accountKindValues),
  currency: currencySchema,
});

const createCategoryInputSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(categoryKindValues),
});

const createBudgetInputSchema = z.object({
  categoryId: idSchema,
  periodStart: dateSchema,
  periodEnd: dateSchema,
  limit: decimalSchema,
});

const createTransactionInputSchema = z.object({
  accountId: idSchema,
  categoryId: idSchema.optional(),
  amount: decimalSchema,
  isFlagged: z.boolean().optional(),
  reason: z.string().trim().min(1).optional(),
  occurredAt: dateSchema,
});

const reverseTransactionInputSchema = z.object({
  id: idSchema,
  reason: z.string().trim().min(1),
});

const finalizeTransactionInputSchema = z.object({
  approvalId: idSchema,
});

const reportsRangeInputSchema = z.object({
  periodStart: dateSchema,
  periodEnd: dateSchema,
});

const listTransactionsInputSchema = z.object({
  accountId: idSchema.optional(),
  categoryId: idSchema.optional(),
  status: z.enum(["PENDING", "POSTED", "REVERSED"]).optional(),
  range: z
    .object({
      from: dateSchema.optional(),
      to: dateSchema.optional(),
    })
    .optional(),
  cursor: idSchema.optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
});

export const financeRouter = router({
  accounts: {
    list: protectedProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
      return await createFinanceService(ctx.db).listAccounts(input);
    }),

    create: protectedProcedure
      .input(createAccountInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createFinanceService(ctx.db).createAccount({
          actorId: ctx.user.id,
          ...input,
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: idSchema,
          patch: z.object({
            name: z.string().trim().min(1).optional(),
            kind: z.enum(accountKindValues).optional(),
            currency: currencySchema.optional(),
          }),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return await createFinanceService(ctx.db).updateAccount({
          actorId: ctx.user.id,
          id: input.id,
          patch: input.patch,
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: idSchema }))
      .mutation(async ({ ctx, input }) => {
        return await createFinanceService(ctx.db).deleteAccount({
          actorId: ctx.user.id,
          id: input.id,
        });
      }),
  },

  categories: {
    list: protectedProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
      return await createFinanceService(ctx.db).listCategories(input);
    }),

    create: protectedProcedure
      .input(createCategoryInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createFinanceService(ctx.db).createCategory({
          actorId: ctx.user.id,
          ...input,
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: idSchema,
          patch: z.object({
            name: z.string().trim().min(1).optional(),
            kind: z.enum(categoryKindValues).optional(),
          }),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return await createFinanceService(ctx.db).updateCategory({
          actorId: ctx.user.id,
          id: input.id,
          patch: input.patch,
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: idSchema }))
      .mutation(async ({ ctx, input }) => {
        return await createFinanceService(ctx.db).deleteCategory({
          actorId: ctx.user.id,
          id: input.id,
        });
      }),
  },

  budgets: {
    list: protectedProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
      return await createFinanceService(ctx.db).listBudgets(input);
    }),

    create: protectedProcedure
      .input(createBudgetInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createFinanceService(ctx.db).createBudget({
          actorId: ctx.user.id,
          categoryId: input.categoryId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          limit: new Prisma.Decimal(input.limit),
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: idSchema,
          patch: z.object({
            categoryId: idSchema.optional(),
            periodStart: dateSchema.optional(),
            periodEnd: dateSchema.optional(),
            limit: decimalSchema.optional(),
          }),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return await createFinanceService(ctx.db).updateBudget({
          actorId: ctx.user.id,
          id: input.id,
          patch: {
            categoryId: input.patch.categoryId,
            periodStart: input.patch.periodStart,
            periodEnd: input.patch.periodEnd,
            limit: input.patch.limit === undefined ? undefined : new Prisma.Decimal(input.patch.limit),
          },
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: idSchema }))
      .mutation(async ({ ctx, input }) => {
        return await createFinanceService(ctx.db).deleteBudget({
          actorId: ctx.user.id,
          id: input.id,
        });
      }),
  },

  transactions: {
    list: protectedProcedure
      .input(listTransactionsInputSchema)
      .query(async ({ ctx, input }) => {
        return await createFinanceService(ctx.db).listTransactions(input);
      }),

    create: protectedProcedure
      .input(createTransactionInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createFinanceService(ctx.db).createTransaction({
          actorId: ctx.user.id,
          accountId: input.accountId,
          categoryId: input.categoryId,
          amount: new Prisma.Decimal(input.amount),
          isFlagged: input.isFlagged,
          reason: input.reason,
          occurredAt: input.occurredAt,
        });
      }),

    reverse: protectedProcedure
      .input(reverseTransactionInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createFinanceService(ctx.db).reverseTransaction({
          actorId: ctx.user.id,
          id: input.id,
          reason: input.reason,
        });
      }),

    finalizeApproval: protectedProcedure
      .input(finalizeTransactionInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createFinanceService(ctx.db).finalizeApprovedTransaction({
          actorId: ctx.user.id,
          approvalId: input.approvalId,
        });
      }),
  },

  reports: {
    accountBalances: protectedProcedure.query(async ({ ctx }) => {
      return await createFinanceService(ctx.db).accountBalances();
    }),

    budgetVsActual: protectedProcedure
      .input(reportsRangeInputSchema)
      .query(async ({ ctx, input }) => {
        return await createFinanceService(ctx.db).budgetVsActual({
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        });
      }),
  },
});
