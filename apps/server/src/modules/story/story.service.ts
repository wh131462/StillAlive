import { prisma } from '../../lib/prisma';
import { errors } from '../../lib/response';
import { isValidStoryContent, STORY_TITLE_MAX } from '@stillalive/core';

const SENSITIVE_KEYWORDS = ['抑郁', '自杀', '想死', '不想活'];

function maskAuthor(story: {
  id: string;
  title: string | null;
  content: string;
  approximateDate: string | null;
  category: string | null;
  hasSensitiveContent: boolean;
  resonanceCount: number;
  status: string;
  createdAt: Date;
  publishedAt: Date | null;
}) {
  return {
    id: story.id,
    title: story.title,
    content: story.content,
    approximateDate: story.approximateDate,
    category: story.category,
    hasSensitiveContent: story.hasSensitiveContent,
    resonanceCount: story.resonanceCount,
    status: story.status,
    createdAt: story.createdAt.toISOString(),
    publishedAt: story.publishedAt?.toISOString() ?? null,
  };
}

export const storyService = {
  async list(params: { category?: string; cursor?: string; limit?: number }) {
    const limit = Math.min(params.limit ?? 10, 50);
    const stories = await prisma.story.findMany({
      where: {
        status: 'approved',
        ...(params.category && { category: params.category }),
      },
      orderBy: { publishedAt: 'desc' },
      take: limit + 1,
      ...(params.cursor && { cursor: { id: params.cursor }, skip: 1 }),
    });
    const hasMore = stories.length > limit;
    const items = stories.slice(0, limit).map(maskAuthor);
    return {
      items,
      nextCursor: hasMore ? stories[limit - 1]!.id : null,
    };
  },

  async detail(id: string) {
    const story = await prisma.story.findFirst({ where: { id, status: 'approved' } });
    if (!story) throw errors.notFound('故事不存在或未通过审核');
    return maskAuthor(story);
  },

  async random(category?: string) {
    const count = await prisma.story.count({
      where: { status: 'approved', ...(category && { category }) },
    });
    if (count === 0) throw errors.notFound('暂无故事');
    const skip = Math.floor(Math.random() * count);
    const [story] = await prisma.story.findMany({
      where: { status: 'approved', ...(category && { category }) },
      skip,
      take: 1,
    });
    return maskAuthor(story!);
  },

  async submit(data: { title?: string; content: string; approximateDate?: string; category?: string; contactEmail?: string }, authorUserId?: string) {
    if (!isValidStoryContent(data.content)) {
      throw errors.badRequest('正文需 100~800 字');
    }
    if (data.title && data.title.length > STORY_TITLE_MAX) {
      throw errors.badRequest(`标题最多 ${STORY_TITLE_MAX} 字`);
    }
    const hasSensitive = SENSITIVE_KEYWORDS.some(k => data.content.includes(k));
    const story = await prisma.story.create({
      data: {
        title: data.title ?? null,
        content: data.content,
        approximateDate: data.approximateDate ?? null,
        category: data.category ?? null,
        contactEmail: data.contactEmail ?? null,
        authorUserId: authorUserId ?? null,
        hasSensitiveContent: hasSensitive,
        status: 'pending',
      },
    });
    return { id: story.id };
  },

  async resonate(storyId: string, params: { userId?: string; deviceId?: string }) {
    const story = await prisma.story.findFirst({ where: { id: storyId, status: 'approved' } });
    if (!story) throw errors.notFound('故事不存在');
    if (!params.userId && !params.deviceId) {
      throw errors.badRequest('需登录或提供设备标识');
    }

    const existing = await prisma.resonance.findFirst({
      where: {
        storyId,
        ...(params.userId ? { userId: params.userId } : { deviceId: params.deviceId }),
      },
    });
    if (existing) {
      return { resonanceCount: story.resonanceCount, alreadyResonated: true };
    }

    await prisma.$transaction([
      prisma.resonance.create({
        data: {
          storyId,
          userId: params.userId ?? null,
          deviceId: params.deviceId ?? null,
        },
      }),
      prisma.story.update({
        where: { id: storyId },
        data: { resonanceCount: { increment: 1 } },
      }),
    ]);

    return { resonanceCount: story.resonanceCount + 1, alreadyResonated: false };
  },

  async myStories(userId: string) {
    const stories = await prisma.story.findMany({
      where: { authorUserId: userId },
      orderBy: { createdAt: 'desc' },
    });
    return stories.map(maskAuthor);
  },

  // ----- 后台审核接口（管理员用）-----
  async listPending() {
    const stories = await prisma.story.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
    return stories.map(maskAuthor);
  },

  async approve(id: string) {
    return prisma.story.update({
      where: { id },
      data: { status: 'approved', publishedAt: new Date() },
    });
  },

  async reject(id: string) {
    return prisma.story.update({ where: { id }, data: { status: 'rejected' } });
  },
};
