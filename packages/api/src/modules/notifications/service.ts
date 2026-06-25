import type { Prisma } from "@hibi/db";
import { type EntityType, type NotificationType, type PrismaClient } from "@hibi/db";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const MAX_MESSAGE_LENGTH = 160;

export const NOTIFICATION_TYPES = {
  APPROVAL_PENDING: "APPROVAL_PENDING" as const,
  TASK_ASSIGNED: "TASK_ASSIGNED" as const,
  TASK_MENTION: "TASK_MENTION" as const,
} as const;

type UserRecord = {
  id: string;
  name: string;
};

type NotificationDelegate = {
  create(args: {
    data: Prisma.NotificationCreateInput;
  }): Promise<NotificationRecord>;
  findMany(args: {
    where: Prisma.NotificationWhereInput;
    orderBy:
      | Prisma.NotificationOrderByWithRelationInput
      | Array<Prisma.NotificationOrderByWithRelationInput>;
    take: number;
    cursor?: {
      id: string;
    };
    skip?: number;
  }): Promise<NotificationRecord[]>;
  count(args: {
    where: Prisma.NotificationWhereInput;
  }): Promise<number>;
  updateMany(args: {
    where: Prisma.NotificationWhereInput;
    data: Prisma.NotificationUpdateManyMutationInput;
  }): Promise<Prisma.BatchPayload>;
};

type NotificationTransaction = {
  notification: NotificationDelegate;
};

type UserDelegate = {
  findMany(args: {
    where: {
      id: {
        in: string[];
      };
    };
    select: {
      id: true;
      name: true;
    };
  }): Promise<Array<UserRecord>>;
};

type ListInput = {
  actorId: string;
  unreadOnly?: boolean;
  cursor?: string;
  type?: NotificationType;
  limit?: number;
};

export type NotificationRecord = {
  id: string;
  recipientId: string;
  actorId: string;
  type: NotificationType;
  entityType: EntityType;
  entityId: string;
  title: string;
  message: string | null;
  targetPath: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
};

export type ListNotificationsResult = {
  items: Array<NotificationRecord>;
  unreadCount: number;
  nextCursor?: string;
};

export type MarkNotificationsInput = {
  actorId: string;
  ids: string[];
};

export type MarkAllNotificationsInput = {
  actorId: string;
};

export type CreateNotificationInput = {
  actorId: string;
  recipientId: string;
  type: NotificationType;
  entityType: EntityType;
  entityId: string;
  title: string;
  message?: string | null;
  targetPath?: string | null;
};

export type NotificationServiceDb = {
  $transaction<T>(
    fn: (tx: NotificationTransaction & UserDelegate) => Promise<T>,
  ): Promise<T>;
  notification: NotificationDelegate;
  user: UserDelegate;
};

export class NotificationService {
  constructor(private readonly db: NotificationServiceDb) {}

  async list(input: ListInput): Promise<ListNotificationsResult> {
    const limit = normalizeLimit(input.limit);
    const take = limit + 1;

    const where = {
      recipientId: input.actorId,
      ...(input.unreadOnly
        ? {
            isRead: false,
          }
        : undefined),
      ...(input.type
        ? {
            type: input.type,
          }
        : undefined),
    } satisfies Prisma.NotificationWhereInput;

    const rows = await this.db.notification.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : undefined,
    });

    const unreadCount = await this.db.notification.count({
      where: {
        recipientId: input.actorId,
        isRead: false,
      },
    });

    const items = rows.slice(0, limit);

    return {
      items,
      unreadCount,
      nextCursor: rows.length > limit ? items.at(-1)?.id : undefined,
    };
  }

  async markAsRead(input: MarkNotificationsInput) {
    const updated = await this.db.$transaction(async (tx) => {
      return await tx.notification.updateMany({
        where: {
          recipientId: input.actorId,
          id: {
            in: input.ids,
          },
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    });

    return {
      count: updated.count,
    };
  }

  async markAllAsRead(input: MarkAllNotificationsInput) {
    const updated = await this.db.$transaction(async (tx) => {
      return await tx.notification.updateMany({
        where: {
          recipientId: input.actorId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    });

    return {
      count: updated.count,
    };
  }

  async resolveUserDirectory(ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      return {} as Record<string, string>;
    }

    const users = await this.db.user.findMany({
      where: {
        id: {
          in: uniqueIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    return users.reduce<Record<string, string>>((accumulator, user) => {
      accumulator[user.id] = user.name;
      return accumulator;
    }, {});
  }
}

export function createNotificationService(db: NotificationServiceDb | PrismaClient) {
  return new NotificationService(db as NotificationServiceDb);
}

export type CreateNotificationTx = {
  notification?: Pick<NotificationTransaction["notification"], "create">;
};

export async function createNotification(
  tx: CreateNotificationTx | null | undefined,
  input: CreateNotificationInput,
) {
  if (!tx?.notification) {
    return;
  }

  await tx.notification.create({
    data: {
      actorId: input.actorId,
      recipientId: input.recipientId,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      message: input.message?.slice(0, MAX_MESSAGE_LENGTH) ?? null,
      targetPath: input.targetPath ?? null,
    },
  });
}

function normalizeLimit(limit?: number) {
  if (limit === undefined) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_LIST_LIMIT);
}
