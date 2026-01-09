import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

const checkinSchema = z.object({
  content: z.string().optional(),
  photo: z.string().optional(),
});

export async function checkinRoutes(fastify: FastifyInstance) {
  // 认证中间件
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: '未授权' });
    }
  });

  // 今日打卡
  fastify.post('/today', async (request) => {
    const { userId } = request.user as { userId: string };
    const { content, photo } = checkinSchema.parse(request.body);
    const today = dayjs().startOf('day').toDate();

    const checkin = await prisma.checkin.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: {
        content,
        photo,
      },
      create: {
        userId,
        date: today,
        content,
        photo,
      },
    });

    return checkin;
  });

  // 获取今日打卡状态
  fastify.get('/today', async (request) => {
    const { userId } = request.user as { userId: string };
    const today = dayjs().startOf('day').toDate();

    const checkin = await prisma.checkin.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    return { checkedIn: !!checkin, checkin };
  });

  // 获取打卡历史
  fastify.get('/history', async (request) => {
    const { userId } = request.user as { userId: string };
    const { month, year } = request.query as { month?: string; year?: string };

    const startDate = dayjs(`${year || dayjs().year()}-${month || dayjs().month() + 1}-01`).startOf('month').toDate();
    const endDate = dayjs(startDate).endOf('month').toDate();

    const checkins = await prisma.checkin.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'desc' },
    });

    return checkins;
  });

  // 获取打卡统计
  fastify.get('/stats', async (request) => {
    const { userId } = request.user as { userId: string };

    const totalCheckins = await prisma.checkin.count({ where: { userId } });
    const totalRecords = await prisma.checkin.count({
      where: { userId, content: { not: null } },
    });

    // 计算连续打卡天数
    const checkins = await prisma.checkin.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    let streak = 0;
    let currentDate = dayjs().startOf('day');

    for (const checkin of checkins) {
      const checkinDate = dayjs(checkin.date).startOf('day');
      if (checkinDate.isSame(currentDate) || checkinDate.isSame(currentDate.subtract(1, 'day'))) {
        streak++;
        currentDate = checkinDate;
      } else {
        break;
      }
    }

    return {
      totalDays: totalCheckins,
      streak,
      totalRecords,
    };
  });
}
