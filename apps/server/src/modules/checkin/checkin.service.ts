import { prisma } from '../../lib/prisma';
import { errors } from '../../lib/response';
import { todayString, daysBetween, isWithinDays } from '@stillalive/core';
import { isMilestoneDay, getMilestoneMessage, getNextMilestone } from '@stillalive/core';

const MAX_RETROACTIVE_DAYS = 7;
const MAX_RETROACTIVE_PER_MONTH = 3;

export const checkinService = {
  async checkIn(userId: string, data?: { content?: string; photoUrl?: string; moodTag?: string }) {
    const date = todayString();
    const existing = await prisma.checkIn.findUnique({ where: { userId_date: { userId, date } } });
    if (existing) {
      return existing;
    }
    return prisma.checkIn.create({
      data: {
        userId,
        date,
        content: data?.content ?? null,
        photoUrl: data?.photoUrl ?? null,
        moodTag: data?.moodTag ?? null,
      },
    });
  },

  async retroactive(userId: string, date: string, data?: { content?: string; photoUrl?: string; moodTag?: string }) {
    if (!isWithinDays(date, MAX_RETROACTIVE_DAYS)) {
      throw errors.badRequest(`补签仅限过去 ${MAX_RETROACTIVE_DAYS} 天内`);
    }
    if (date >= todayString()) {
      throw errors.badRequest('不能补签今天或未来日期');
    }
    const existing = await prisma.checkIn.findUnique({ where: { userId_date: { userId, date } } });
    if (existing) throw errors.conflict('该日期已有打卡记录');

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const retroCount = await prisma.checkIn.count({
      where: { userId, isRetroactive: true, date: { gte: monthStart } },
    });
    if (retroCount >= MAX_RETROACTIVE_PER_MONTH) {
      throw errors.badRequest(`本月补签次数已用完（最多 ${MAX_RETROACTIVE_PER_MONTH} 次）`);
    }

    return prisma.checkIn.create({
      data: {
        userId,
        date,
        isRetroactive: true,
        content: data?.content ?? null,
        photoUrl: data?.photoUrl ?? null,
        moodTag: data?.moodTag ?? null,
      },
    });
  },

  async update(userId: string, id: string, data: { content?: string; photoUrl?: string; moodTag?: string }) {
    const record = await prisma.checkIn.findFirst({ where: { id, userId } });
    if (!record) throw errors.notFound('打卡记录不存在');
    return prisma.checkIn.update({
      where: { id },
      data: {
        ...(data.content !== undefined && { content: data.content }),
        ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
        ...(data.moodTag !== undefined && { moodTag: data.moodTag }),
      },
    });
  },

  async list(userId: string, from?: string, to?: string) {
    return prisma.checkIn.findMany({
      where: {
        userId,
        ...(from && { date: { gte: from, ...(to && { lte: to }) } }),
      },
      orderBy: { date: 'desc' },
    });
  },

  async byDate(userId: string, date: string) {
    return prisma.checkIn.findUnique({ where: { userId_date: { userId, date } } });
  },

  async stats(userId: string) {
    const totalDays = await prisma.checkIn.count({ where: { userId } });
    const recordCount = await prisma.checkIn.count({ where: { userId, content: { not: null } } });
    const consecutiveDays = await this.calcConsecutiveDays(userId);
    const milestoneInfo = isMilestoneDay(consecutiveDays)
      ? { days: consecutiveDays, achieved: true, message: getMilestoneMessage(consecutiveDays)! }
      : null;
    const nextMilestone = getNextMilestone(consecutiveDays);

    return { totalDays, consecutiveDays, recordCount, milestoneInfo, nextMilestone };
  },

  async calcConsecutiveDays(userId: string): Promise<number> {
    const records = await prisma.checkIn.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (records.length === 0) return 0;
    const today = todayString();
    if (records[0]!.date !== today) return 0;

    let count = 1;
    for (let i = 1; i < records.length; i++) {
      const diff = daysBetween(records[i]!.date, records[i - 1]!.date);
      if (diff !== 1) break;
      count++;
    }
    return count;
  },
};
