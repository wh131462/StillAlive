import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

// ==================== Schema 定义 ====================

const moodEnum = z.enum(['happy', 'calm', 'tired', 'sad', 'anxious', 'excited']);

const checkinSchema = z.object({
  content: z.string().optional(),
  photo: z.string().optional(),
  mood: moodEnum.optional(),
});

const makeupCheckinSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
  content: z.string().optional(),
  mood: moodEnum.optional(),
});

// ==================== 常量 ====================

const MAKEUP_LIMIT_PER_MONTH = 3;
const MAKEUP_DAYS_LIMIT = 7;

// ==================== 辅助函数 ====================

// 计算连续打卡天数
async function calculateStreak(userId: string): Promise<number> {
  const checkins = await prisma.checkin.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    select: { date: true },
  });

  if (checkins.length === 0) return 0;

  let streak = 0;
  let currentDate = dayjs().startOf('day');

  // 检查今天是否打卡
  const todayCheckin = checkins.find(c => dayjs(c.date).isSame(currentDate, 'day'));
  if (!todayCheckin) {
    // 如果今天没打卡，从昨天开始算
    currentDate = currentDate.subtract(1, 'day');
  }

  for (const checkin of checkins) {
    const checkinDate = dayjs(checkin.date).startOf('day');
    if (checkinDate.isSame(currentDate, 'day')) {
      streak++;
      currentDate = currentDate.subtract(1, 'day');
    } else if (checkinDate.isBefore(currentDate, 'day')) {
      // 有间断，停止计算
      break;
    }
  }

  return streak;
}

// 计算最长连续打卡天数
async function calculateLongestStreak(userId: string): Promise<number> {
  const checkins = await prisma.checkin.findMany({
    where: { userId },
    orderBy: { date: 'asc' },
    select: { date: true },
  });

  if (checkins.length === 0) return 0;

  let longestStreak = 1;
  let currentStreak = 1;
  let prevDate = dayjs(checkins[0].date);

  for (let i = 1; i < checkins.length; i++) {
    const currentDate = dayjs(checkins[i].date);
    const diff = currentDate.diff(prevDate, 'day');

    if (diff === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else if (diff > 1) {
      currentStreak = 1;
    }
    // diff === 0 意味着同一天，跳过

    prevDate = currentDate;
  }

  return longestStreak;
}

// 检查里程碑
function checkMilestone(streak: number): { achieved: boolean; days: number; name: string } | null {
  const milestones = [
    { days: 7, name: '初心者' },
    { days: 30, name: '坚持者' },
    { days: 100, name: '证明者' },
    { days: 365, name: '史诗' },
    { days: 1000, name: '传说' },
  ];

  for (const milestone of milestones) {
    if (streak === milestone.days) {
      return { achieved: true, ...milestone };
    }
  }
  return null;
}

// ==================== 路由定义 ====================

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
    const { content, photo, mood } = checkinSchema.parse(request.body);
    const today = dayjs().startOf('day').toDate();

    // 检查是否已经打卡
    const existingCheckin = await prisma.checkin.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

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
        mood,
      },
      create: {
        userId,
        date: today,
        content,
        photo,
        mood,
        isMakeup: false,
      },
    });

    // 计算连续打卡
    const streak = await calculateStreak(userId);

    // 检查是否达成里程碑（只有新打卡时才检查）
    const milestone = !existingCheckin ? checkMilestone(streak) : null;

    return {
      checkin,
      streak,
      milestone,
    };
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

    const streak = await calculateStreak(userId);

    return { checkedIn: !!checkin, checkin, streak };
  });

  // 获取打卡历史
  fastify.get('/history', async (request) => {
    const { userId } = request.user as { userId: string };
    const { month, year } = request.query as { month?: string; year?: string };

    const targetYear = parseInt(year || String(dayjs().year()));
    const targetMonth = parseInt(month || String(dayjs().month() + 1));

    const startDate = dayjs(`${targetYear}-${targetMonth}-01`).startOf('month').toDate();
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

    const totalDays = await prisma.checkin.count({ where: { userId } });
    const totalRecords = await prisma.checkin.count({
      where: { userId, content: { not: null } },
    });

    const streak = await calculateStreak(userId);
    const longestStreak = await calculateLongestStreak(userId);

    // 计算打卡率（过去30天）
    const thirtyDaysAgo = dayjs().subtract(30, 'day').startOf('day').toDate();
    const recentCheckins = await prisma.checkin.count({
      where: {
        userId,
        date: { gte: thirtyDaysAgo },
      },
    });
    const checkinRate = Math.round((recentCheckins / 30) * 100);

    return {
      totalDays,
      streak,
      totalRecords,
      checkinRate,
      longestStreak,
    };
  });

  // 补签打卡
  fastify.post('/makeup', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { date, content, mood } = makeupCheckinSchema.parse(request.body);

    const targetDate = dayjs(date).startOf('day');
    const today = dayjs().startOf('day');

    // 检查日期是否在7天内
    const daysDiff = today.diff(targetDate, 'day');
    if (daysDiff <= 0) {
      return reply.status(400).send({ error: '补签日期必须是过去的日期' });
    }
    if (daysDiff > MAKEUP_DAYS_LIMIT) {
      return reply.status(400).send({ error: `只能补签${MAKEUP_DAYS_LIMIT}天内的记录` });
    }

    // 检查该日期是否已打卡
    const existingCheckin = await prisma.checkin.findUnique({
      where: {
        userId_date: {
          userId,
          date: targetDate.toDate(),
        },
      },
    });
    if (existingCheckin) {
      return reply.status(400).send({ error: '该日期已有打卡记录' });
    }

    // 检查本月补签次数
    const yearMonth = today.format('YYYY-MM');
    let makeupRecord = await prisma.makeupRecord.findUnique({
      where: {
        userId_yearMonth: {
          userId,
          yearMonth,
        },
      },
    });

    if (makeupRecord && makeupRecord.count >= MAKEUP_LIMIT_PER_MONTH) {
      return reply.status(400).send({ error: `本月补签次数已达上限(${MAKEUP_LIMIT_PER_MONTH}次)` });
    }

    // 创建补签记录
    const checkin = await prisma.checkin.create({
      data: {
        userId,
        date: targetDate.toDate(),
        content,
        mood,
        isMakeup: true,
      },
    });

    // 更新补签计数
    await prisma.makeupRecord.upsert({
      where: {
        userId_yearMonth: {
          userId,
          yearMonth,
        },
      },
      update: {
        count: { increment: 1 },
      },
      create: {
        userId,
        yearMonth,
        count: 1,
      },
    });

    // 重新获取补签记录
    makeupRecord = await prisma.makeupRecord.findUnique({
      where: {
        userId_yearMonth: {
          userId,
          yearMonth,
        },
      },
    });

    return {
      checkin,
      makeupCount: {
        yearMonth,
        count: makeupRecord?.count || 1,
        limit: MAKEUP_LIMIT_PER_MONTH,
        remaining: MAKEUP_LIMIT_PER_MONTH - (makeupRecord?.count || 1),
      },
    };
  });

  // 获取补签次数
  fastify.get('/makeup-count', async (request) => {
    const { userId } = request.user as { userId: string };
    const { month } = request.query as { month?: string };

    const yearMonth = month || dayjs().format('YYYY-MM');

    const makeupRecord = await prisma.makeupRecord.findUnique({
      where: {
        userId_yearMonth: {
          userId,
          yearMonth,
        },
      },
    });

    return {
      yearMonth,
      count: makeupRecord?.count || 0,
      limit: MAKEUP_LIMIT_PER_MONTH,
      remaining: MAKEUP_LIMIT_PER_MONTH - (makeupRecord?.count || 0),
    };
  });

  // 获取年度热力图数据
  fastify.get('/heatmap/:year', async (request) => {
    const { userId } = request.user as { userId: string };
    const { year } = request.params as { year: string };

    const targetYear = parseInt(year) || dayjs().year();
    const startDate = dayjs(`${targetYear}-01-01`).startOf('year').toDate();
    const endDate = dayjs(`${targetYear}-12-31`).endOf('year').toDate();

    const checkins = await prisma.checkin.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
        content: true,
        mood: true,
      },
    });

    // 转换为热力图数据格式
    const heatmapData = checkins.map(c => ({
      date: dayjs(c.date).format('YYYY-MM-DD'),
      count: c.content ? 2 : 1, // 有内容记录的更"热"
    }));

    return {
      year: targetYear,
      data: heatmapData,
    };
  });

  // 获取某一天的详情
  fastify.get('/detail/:date', async (request) => {
    const { userId } = request.user as { userId: string };
    const { date } = request.params as { date: string };

    const targetDate = dayjs(date).startOf('day').toDate();

    const checkin = await prisma.checkin.findUnique({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
    });

    if (!checkin) {
      return { checkin: null };
    }

    return { checkin };
  });

  // 更新某一天的记录（只能更新内容和心情，不能改变打卡状态）
  fastify.put('/detail/:date', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { date } = request.params as { date: string };
    const { content, photo, mood } = checkinSchema.parse(request.body);

    const targetDate = dayjs(date).startOf('day').toDate();

    const existingCheckin = await prisma.checkin.findUnique({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
    });

    if (!existingCheckin) {
      return reply.status(404).send({ error: '该日期没有打卡记录' });
    }

    const checkin = await prisma.checkin.update({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
      data: {
        content,
        photo,
        mood,
      },
    });

    return { checkin };
  });
}
