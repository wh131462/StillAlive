/**
 * 每日信息差路由
 * 提供每日新闻汇总和历史上的今天
 */

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

// ============ 类型定义 ============

interface DailyNewsItem {
  id: string;
  title: string;
  summary: string;
  category: 'tech' | 'world' | 'finance' | 'science' | 'culture' | 'sports' | 'other';
  source?: string;
  url?: string;
  importance: 1 | 2 | 3;
}

interface HistoryTodayItem {
  year: number;
  event: string;
  category: 'history' | 'birth' | 'death' | 'invention' | 'culture';
}

interface DailyInfoContent {
  date: string;
  news: DailyNewsItem[];
  historyToday: HistoryTodayItem[];
  generatedAt: string;
}

// ============ 路由 ============

export async function dailyInfoRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/daily-info
   * 获取今日信息差 (公开接口，不需要认证)
   */
  fastify.get('/', async () => {
    const today = dayjs().format('YYYY-MM-DD');

    // 尝试从数据库获取
    const existing = await prisma.dailyInfo.findUnique({
      where: { date: today },
    });

    if (existing) {
      return existing.content as DailyInfoContent;
    }

    // 返回默认内容
    return generateDefaultDailyInfo(today);
  });

  /**
   * GET /api/daily-info/history
   * 获取历史信息差
   */
  fastify.get('/history', async (request) => {
    const { limit = 7 } = request.query as { limit?: number };

    const records = await prisma.dailyInfo.findMany({
      orderBy: { date: 'desc' },
      take: Math.min(limit, 30),
    });

    return records.map((r) => r.content as DailyInfoContent);
  });

  /**
   * POST /api/daily-info/generate (内部接口)
   * 手动触发生成今日信息差
   * TODO: 实现自动化采集逻辑
   */
  fastify.post('/generate', async (request, reply) => {
    // 简单的 API Key 验证
    const apiKey = request.headers['x-api-key'];
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      return reply.status(403).send({ error: '无权限' });
    }

    const today = dayjs().format('YYYY-MM-DD');

    // TODO: 实现新闻采集逻辑
    // 1. 调用新闻 API (NewsAPI, RSSHub 等)
    // 2. 使用 AI 筛选和生成摘要
    // 3. 存储到数据库

    const content = await generateDailyInfoWithSources(today);

    await prisma.dailyInfo.upsert({
      where: { date: today },
      update: { content },
      create: { date: today, content },
    });

    return content;
  });
}

// ============ 辅助函数 ============

/**
 * 生成默认的每日信息差 (无新闻源时使用)
 */
function generateDefaultDailyInfo(date: string): DailyInfoContent {
  const historyToday = getHistoryToday(date);

  return {
    date,
    news: [
      {
        id: 'placeholder-1',
        title: '每日信息差服务启动中',
        summary: '我们正在收集今日的重要新闻，请稍后刷新查看',
        category: 'other',
        importance: 1,
      },
    ],
    historyToday,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 从数据源生成每日信息差
 * TODO: 实现真实的新闻采集逻辑
 */
async function generateDailyInfoWithSources(date: string): Promise<DailyInfoContent> {
  // 获取历史上的今天
  const historyToday = getHistoryToday(date);

  // TODO: 实现新闻采集
  // 目前返回示例数据
  const news: DailyNewsItem[] = [
    {
      id: `news-${date}-1`,
      title: 'AI 技术持续突破',
      summary: '人工智能领域迎来新的发展机遇，多项技术取得重要进展',
      category: 'tech',
      source: 'TechNews',
      importance: 3,
    },
    {
      id: `news-${date}-2`,
      title: '全球经济动态',
      summary: '各国央行政策调整影响全球市场走势',
      category: 'finance',
      source: 'Finance Daily',
      importance: 2,
    },
  ];

  return {
    date,
    news,
    historyToday,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 获取历史上的今天
 */
function getHistoryToday(date: string): HistoryTodayItem[] {
  const [, month, day] = date.split('-');
  const mmdd = `${month}-${day}`;

  // 历史事件数据库 (可扩展为从外部 API 获取)
  const historyDatabase: Record<string, HistoryTodayItem[]> = {
    '01-01': [
      { year: 1804, event: '海地独立，成为拉丁美洲第一个独立国家', category: 'history' },
      { year: 1912, event: '中华民国成立', category: 'history' },
    ],
    '01-15': [
      { year: 2001, event: '维基百科正式上线', category: 'invention' },
      { year: 1929, event: '马丁·路德·金出生', category: 'birth' },
    ],
    '01-16': [
      { year: 1979, event: '伊朗国王巴列维流亡海外', category: 'history' },
      { year: 2003, event: '哥伦比亚号航天飞机发射', category: 'history' },
    ],
    '02-14': [
      { year: 1876, event: '亚历山大·贝尔申请电话专利', category: 'invention' },
    ],
    '03-14': [
      { year: 1879, event: '阿尔伯特·爱因斯坦出生', category: 'birth' },
      { year: 2018, event: '史蒂芬·霍金逝世', category: 'death' },
    ],
    '04-22': [
      { year: 1970, event: '第一个地球日', category: 'history' },
    ],
    '07-20': [
      { year: 1969, event: '阿波罗11号登月，人类首次踏上月球', category: 'history' },
    ],
    '10-01': [
      { year: 1949, event: '中华人民共和国成立', category: 'history' },
    ],
    '12-25': [
      { year: 1642, event: '艾萨克·牛顿出生', category: 'birth' },
    ],
  };

  return historyDatabase[mmdd] || [
    {
      year: 2000,
      event: '新千年开始，全球迎接新时代',
      category: 'history',
    },
  ];
}
