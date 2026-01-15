/**
 * 数据同步路由
 * 处理客户端与服务器之间的数据同步
 */

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// ============ Schema 定义 ============

const syncChangeSchema = z.object({
  collection: z.enum(['checkins', 'people']),
  operation: z.enum(['upsert', 'delete']),
  data: z.any(),
  localUpdatedAt: z.number(),
});

const pushSchema = z.object({
  lastSyncAt: z.number(),
  changes: z.array(syncChangeSchema),
});

const pullSchema = z.object({
  lastSyncAt: z.number(),
});

// ============ 路由 ============

export async function syncRoutes(fastify: FastifyInstance) {
  // 认证中间件
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: '未授权' });
    }
  });

  /**
   * POST /api/sync/push
   * 推送本地变更到服务器
   */
  fastify.post('/push', async (request) => {
    const { userId } = request.user as { userId: string };
    const { lastSyncAt, changes } = pushSchema.parse(request.body);

    const accepted: string[] = [];
    const conflicts: Array<{
      id: string;
      collection: 'checkins' | 'people';
      serverData: unknown;
    }> = [];

    for (const change of changes) {
      const { collection, operation, data, localUpdatedAt } = change;

      try {
        if (collection === 'checkins') {
          await handleCheckinChange(userId, operation, data, localUpdatedAt, accepted, conflicts);
        } else if (collection === 'people') {
          await handlePersonChange(userId, operation, data, localUpdatedAt, accepted, conflicts);
        }
      } catch (error) {
        console.error(`Sync error for ${collection}:`, error);
      }
    }

    return {
      syncedAt: Date.now(),
      accepted,
      conflicts,
    };
  });

  /**
   * POST /api/sync/pull
   * 从服务器拉取变更
   */
  fastify.post('/pull', async (request) => {
    const { userId } = request.user as { userId: string };
    const { lastSyncAt } = pullSchema.parse(request.body);

    const lastSyncDate = new Date(lastSyncAt);

    // 获取自上次同步后更新的打卡记录
    const checkins = await prisma.checkin.findMany({
      where: {
        userId,
        updatedAt: { gt: lastSyncDate },
      },
    });

    // 获取自上次同步后更新的人物记录
    const people = await prisma.person.findMany({
      where: {
        userId,
        updatedAt: { gt: lastSyncDate },
      },
    });

    return {
      checkins: checkins.map(transformCheckin),
      people: people.map(transformPerson),
      serverTime: Date.now(),
    };
  });

  /**
   * GET /api/sync/status
   * 获取同步状态
   */
  fastify.get('/status', async (request) => {
    const { userId } = request.user as { userId: string };

    const checkinsCount = await prisma.checkin.count({ where: { userId } });
    const peopleCount = await prisma.person.count({ where: { userId } });

    return {
      checkinsCount,
      peopleCount,
      lastServerUpdate: Date.now(),
    };
  });
}

// ============ 辅助函数 ============

/**
 * 处理打卡记录变更
 */
async function handleCheckinChange(
  userId: string,
  operation: 'upsert' | 'delete',
  data: any,
  localUpdatedAt: number,
  accepted: string[],
  conflicts: Array<{ id: string; collection: 'checkins' | 'people'; serverData: unknown }>
) {
  if (operation === 'delete') {
    // 删除操作
    await prisma.checkin.deleteMany({
      where: { id: data.id, userId },
    });
    accepted.push(data.id);
    return;
  }

  // Upsert 操作
  const existing = await prisma.checkin.findFirst({
    where: { id: data.id, userId },
  });

  if (existing) {
    // 检查冲突 (服务端更新时间更晚)
    if (existing.updatedAt.getTime() > localUpdatedAt) {
      conflicts.push({
        id: data.id,
        collection: 'checkins',
        serverData: transformCheckin(existing),
      });
      return;
    }

    // 更新
    await prisma.checkin.update({
      where: { id: data.id },
      data: {
        date: new Date(data.date),
        content: data.content,
        photo: data.photo,
        updatedAt: new Date(data.updatedAt),
      },
    });
  } else {
    // 创建新记录
    await prisma.checkin.create({
      data: {
        id: data.id,
        userId,
        date: new Date(data.date),
        content: data.content,
        photo: data.photo,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      },
    });
  }

  accepted.push(data.id);
}

/**
 * 处理人物记录变更
 */
async function handlePersonChange(
  userId: string,
  operation: 'upsert' | 'delete',
  data: any,
  localUpdatedAt: number,
  accepted: string[],
  conflicts: Array<{ id: string; collection: 'checkins' | 'people'; serverData: unknown }>
) {
  if (operation === 'delete') {
    // 删除操作
    await prisma.person.deleteMany({
      where: { id: data.id, userId },
    });
    accepted.push(data.id);
    return;
  }

  // Upsert 操作
  const existing = await prisma.person.findFirst({
    where: { id: data.id, userId },
  });

  if (existing) {
    // 检查冲突
    if (existing.updatedAt.getTime() > localUpdatedAt) {
      conflicts.push({
        id: data.id,
        collection: 'people',
        serverData: transformPerson(existing),
      });
      return;
    }

    // 更新
    await prisma.person.update({
      where: { id: data.id },
      data: {
        name: data.name,
        gender: data.gender,
        birthday: data.birthday,
        birthYear: data.birthYear,
        photo: data.photo,
        mbti: data.mbti,
        impression: data.impression,
        experience: data.experience,
        updatedAt: new Date(data.updatedAt),
      },
    });
  } else {
    // 创建新记录
    await prisma.person.create({
      data: {
        id: data.id,
        userId,
        name: data.name,
        gender: data.gender,
        birthday: data.birthday,
        birthYear: data.birthYear,
        photo: data.photo,
        mbti: data.mbti,
        impression: data.impression,
        experience: data.experience,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      },
    });
  }

  accepted.push(data.id);
}

/**
 * 转换打卡记录为客户端格式
 */
function transformCheckin(checkin: any) {
  return {
    id: checkin.id,
    date: checkin.date.toISOString().split('T')[0], // YYYY-MM-DD
    content: checkin.content,
    photo: checkin.photo,
    createdAt: checkin.createdAt.getTime(),
    updatedAt: checkin.updatedAt.getTime(),
    syncStatus: 'synced',
  };
}

/**
 * 转换人物记录为客户端格式
 */
function transformPerson(person: any) {
  return {
    id: person.id,
    name: person.name,
    gender: person.gender,
    birthday: person.birthday,
    birthYear: person.birthYear,
    photo: person.photo,
    mbti: person.mbti,
    impression: person.impression,
    experience: person.experience,
    createdAt: person.createdAt.getTime(),
    updatedAt: person.updatedAt.getTime(),
    syncStatus: 'synced',
  };
}
