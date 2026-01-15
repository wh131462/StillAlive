/**
 * 增值服务路由
 * 年度总结生成等高级功能
 */

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

// ============ 类型定义 ============

interface YearlySummaryContent {
  year: number;
  title: string;
  highlights: string[];
  statistics: {
    totalDays: number;
    longestStreak: number;
    meaningfulMoments: number;
    peopleCherished: number;
  };
  monthlyReview: Array<{
    month: number;
    summary: string;
    keyMoment?: string;
  }>;
  aiInsights: string;
  shareImage?: string;
}

// ============ Schema ============

const generateSchema = z.object({
  year: z.number().min(2020).max(2100),
});

// ============ 路由 ============

export async function premiumRoutes(fastify: FastifyInstance) {
  // 认证中间件
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: '未授权' });
    }
  });

  /**
   * POST /api/premium/yearly-summary/generate
   * 生成年度总结
   */
  fastify.post('/yearly-summary/generate', async (request) => {
    const { userId } = request.user as { userId: string };
    const { year } = generateSchema.parse(request.body);

    // 检查缓存
    const cached = await prisma.yearlySummary.findUnique({
      where: { userId_year: { userId, year } },
    });

    if (cached) {
      return {
        exists: true,
        content: cached.content as YearlySummaryContent,
        cached: true,
      };
    }

    // 收集用户年度数据
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const checkins = await prisma.checkin.findMany({
      where: {
        userId,
        date: { gte: yearStart, lte: yearEnd },
      },
      orderBy: { date: 'asc' },
    });

    const people = await prisma.person.findMany({
      where: {
        userId,
        createdAt: { gte: yearStart, lte: yearEnd },
      },
    });

    // 计算统计数据
    const statistics = calculateStatistics(checkins, people);

    // 生成月度回顾
    const monthlyReview = generateMonthlyReview(checkins, year);

    // 生成总结内容
    const content: YearlySummaryContent = await generateSummaryContent(
      year,
      checkins,
      people,
      statistics,
      monthlyReview
    );

    // 缓存结果
    await prisma.yearlySummary.create({
      data: {
        userId,
        year,
        content,
      },
    });

    return {
      exists: true,
      content,
      cached: false,
    };
  });

  /**
   * GET /api/premium/yearly-summary/:year
   * 获取年度总结
   */
  fastify.get('/yearly-summary/:year', async (request) => {
    const { userId } = request.user as { userId: string };
    const { year } = request.params as { year: string };

    const summary = await prisma.yearlySummary.findUnique({
      where: { userId_year: { userId, year: parseInt(year) } },
    });

    if (!summary) {
      return { exists: false };
    }

    return {
      exists: true,
      content: summary.content as YearlySummaryContent,
    };
  });

  /**
   * DELETE /api/premium/yearly-summary/:year
   * 删除年度总结缓存 (用于重新生成)
   */
  fastify.delete('/yearly-summary/:year', async (request) => {
    const { userId } = request.user as { userId: string };
    const { year } = request.params as { year: string };

    await prisma.yearlySummary.deleteMany({
      where: { userId, year: parseInt(year) },
    });

    return { success: true };
  });
}

// ============ 辅助函数 ============

/**
 * 计算统计数据
 */
function calculateStatistics(
  checkins: any[],
  people: any[]
): YearlySummaryContent['statistics'] {
  const totalDays = checkins.length;
  const meaningfulMoments = checkins.filter((c) => c.content).length;
  const peopleCherished = people.length;

  // 计算最长连续打卡
  let longestStreak = 0;
  let currentStreak = 0;
  let prevDate: Date | null = null;

  for (const checkin of checkins) {
    if (prevDate === null) {
      currentStreak = 1;
    } else {
      const diffDays = Math.floor(
        (checkin.date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays === 1) {
        currentStreak++;
      } else {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
      }
    }
    prevDate = checkin.date;
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  return {
    totalDays,
    longestStreak,
    meaningfulMoments,
    peopleCherished,
  };
}

/**
 * 生成月度回顾
 */
function generateMonthlyReview(
  checkins: any[],
  year: number
): YearlySummaryContent['monthlyReview'] {
  const monthlyData: Map<number, any[]> = new Map();

  // 按月分组
  for (const checkin of checkins) {
    const month = checkin.date.getMonth() + 1;
    if (!monthlyData.has(month)) {
      monthlyData.set(month, []);
    }
    monthlyData.get(month)!.push(checkin);
  }

  const review: YearlySummaryContent['monthlyReview'] = [];

  for (let month = 1; month <= 12; month++) {
    const monthCheckins = monthlyData.get(month) || [];
    const checkinsCount = monthCheckins.length;
    const recordsCount = monthCheckins.filter((c) => c.content).length;

    // 找出关键时刻 (有内容的打卡)
    const keyMoments = monthCheckins.filter((c) => c.content);
    const keyMoment = keyMoments.length > 0 ? keyMoments[0].content : undefined;

    let summary = '';
    if (checkinsCount === 0) {
      summary = '这个月没有打卡记录';
    } else if (checkinsCount < 10) {
      summary = `打卡 ${checkinsCount} 天，记录了 ${recordsCount} 件有意义的事`;
    } else if (checkinsCount < 20) {
      summary = `活跃的一个月！打卡 ${checkinsCount} 天`;
    } else {
      summary = `超级充实的一个月！打卡 ${checkinsCount} 天，记录了 ${recordsCount} 件精彩瞬间`;
    }

    review.push({
      month,
      summary,
      keyMoment: keyMoment?.substring(0, 50),
    });
  }

  return review;
}

/**
 * 生成总结内容
 * TODO: 接入 AI API 生成更个性化的内容
 */
async function generateSummaryContent(
  year: number,
  checkins: any[],
  people: any[],
  statistics: YearlySummaryContent['statistics'],
  monthlyReview: YearlySummaryContent['monthlyReview']
): Promise<YearlySummaryContent> {
  // 生成标题
  let title = '';
  if (statistics.totalDays >= 300) {
    title = `${year}：坚持的力量`;
  } else if (statistics.totalDays >= 200) {
    title = `${year}：稳步前行的一年`;
  } else if (statistics.totalDays >= 100) {
    title = `${year}：充满可能的一年`;
  } else {
    title = `${year}：新的开始`;
  }

  // 生成亮点
  const highlights: string[] = [];

  if (statistics.totalDays > 0) {
    highlights.push(`全年打卡 ${statistics.totalDays} 天，证明你一直都在`);
  }
  if (statistics.longestStreak >= 7) {
    highlights.push(`最长连续打卡 ${statistics.longestStreak} 天，自律的你真棒`);
  }
  if (statistics.meaningfulMoments >= 50) {
    highlights.push(`记录了 ${statistics.meaningfulMoments} 件有意义的事，生活处处是精彩`);
  }
  if (statistics.peopleCherished > 0) {
    highlights.push(`珍视了 ${statistics.peopleCherished} 个重要的人，感情需要用心经营`);
  }

  if (highlights.length === 0) {
    highlights.push('新的一年，新的开始，期待你的精彩故事');
  }

  // 生成 AI 洞察
  // TODO: 接入 Claude API 生成更个性化的内容
  const aiInsights = generateAIInsights(statistics);

  return {
    year,
    title,
    highlights,
    statistics,
    monthlyReview,
    aiInsights,
  };
}

/**
 * 生成 AI 洞察 (临时实现)
 * TODO: 接入真实的 AI API
 */
function generateAIInsights(
  statistics: YearlySummaryContent['statistics']
): string {
  const messages = [
    '每一次打卡，都是对生活的一次确认。',
    '记录不是为了回忆，而是为了证明我们真实地活过。',
    '感谢你又坚持了一年，愿新的一年同样精彩。',
  ];

  if (statistics.totalDays >= 300) {
    return `这一年你打卡了 ${statistics.totalDays} 天，这份坚持本身就是一种力量。${messages[0]} 新的一年，继续加油！`;
  } else if (statistics.totalDays >= 100) {
    return `${statistics.totalDays} 天的打卡记录，见证了你这一年的点点滴滴。${messages[1]} 期待你在新的一年里书写更多故事。`;
  } else {
    return `${messages[2]} 无论打卡多少天，重要的是你选择了记录。每一天都值得被珍惜。`;
  }
}
