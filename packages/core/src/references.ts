import type { EntityType, Prisma } from "@hibi/db";

export const UNLABELED_REFERENCE_RELATION = "__unlabeled__";

type ReferenceDelegate = {
  create(args: {
    data: Prisma.ReferenceCreateInput;
  }): Promise<Prisma.ReferenceGetPayload<object>>;
  findMany(args: {
    where: Prisma.ReferenceWhereInput;
    orderBy: Prisma.ReferenceOrderByWithRelationInput;
  }): Promise<Array<Prisma.ReferenceGetPayload<object>>>;
};

export type ReferenceEndpoint = {
  type: EntityType;
  id: string;
};

export type CreateReferenceInput = {
  from: ReferenceEndpoint;
  to: ReferenceEndpoint;
  relation?: string;
};

export type ListReferencesInput =
  | { from: ReferenceEndpoint; to?: never }
  | { from?: never; to: ReferenceEndpoint };

export type ReferenceTransaction = {
  reference: ReferenceDelegate;
};

export async function createReference(
  tx: ReferenceTransaction,
  input: CreateReferenceInput,
): Promise<Prisma.ReferenceGetPayload<object>> {
  return tx.reference.create({
    data: {
      fromType: input.from.type,
      fromId: input.from.id,
      toType: input.to.type,
      toId: input.to.id,
      relation: input.relation ?? UNLABELED_REFERENCE_RELATION,
    },
  });
}

export async function listReferences(
  tx: ReferenceTransaction,
  input: ListReferencesInput,
): Promise<Array<Prisma.ReferenceGetPayload<object>>> {
  const where = (() => {
    if (input.from) {
      return {
        fromType: input.from.type,
        fromId: input.from.id,
      };
    }

    return {
      toType: input.to.type,
      toId: input.to.id,
    };
  })() satisfies Prisma.ReferenceWhereInput;

  return await tx.reference.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}
