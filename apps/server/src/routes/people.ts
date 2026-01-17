import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

// ==================== Schema 定义 ====================

const genderEnum = z.enum(['male', 'female', 'other']);
const themeColorEnum = z.enum(['rose', 'blue', 'amber', 'purple', 'green', 'slate']);

const personSchema = z.object({
  name: z.string().min(1, '姓名不能为空'),
  groupId: z.string().optional(),
  gender: genderEnum.optional(),
  birthday: z.string().optional(), // MM-DD
  birthYear: z.number().optional(),
  photo: z.string().optional(),
  mbti: z.string().optional(),
  themeColor: themeColorEnum.optional(),
  impression: z.string().optional(),
  experience: z.string().optional(),
});

const groupSchema = z.object({
  name: z.string().min(1, '分组名称不能为空'),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const updateGroupSchema = groupSchema.partial().extend({
  sortOrder: z.number().optional(),
});

// ==================== 路由定义 ====================

export async function peopleRoutes(fastify: FastifyInstance) {
  // 认证中间件
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: '未授权' });
    }
  });

  // ==================== 人物分组路由 ====================

  // 获取所有分组（包含人物数量）
  fastify.get('/groups', async (request) => {
    const { userId } = request.user as { userId: string };

    const groups = await prisma.personGroup.findMany({
      where: { userId },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { people: true },
        },
      },
    });

    return groups;
  });

  // 创建分组
  fastify.post('/groups', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const data = groupSchema.parse(request.body);

    // 检查是否已存在同名分组
    const existingGroup = await prisma.personGroup.findUnique({
      where: {
        userId_name: {
          userId,
          name: data.name,
        },
      },
    });

    if (existingGroup) {
      return reply.status(400).send({ error: '已存在同名分组' });
    }

    // 获取最大排序值
    const maxSortOrder = await prisma.personGroup.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });

    const group = await prisma.personGroup.create({
      data: {
        ...data,
        userId,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
      },
    });

    return group;
  });

  // 更新分组
  fastify.put('/groups/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const data = updateGroupSchema.parse(request.body);

    const group = await prisma.personGroup.findFirst({
      where: { id, userId },
    });

    if (!group) {
      return reply.status(404).send({ error: '分组不存在' });
    }

    // 如果修改名称，检查是否与其他分组重名
    if (data.name && data.name !== group.name) {
      const existingGroup = await prisma.personGroup.findUnique({
        where: {
          userId_name: {
            userId,
            name: data.name,
          },
        },
      });

      if (existingGroup) {
        return reply.status(400).send({ error: '已存在同名分组' });
      }
    }

    const updated = await prisma.personGroup.update({
      where: { id },
      data,
    });

    return updated;
  });

  // 删除分组（人物会保留，groupId 设为 null）
  fastify.delete('/groups/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };

    const group = await prisma.personGroup.findFirst({
      where: { id, userId },
    });

    if (!group) {
      return reply.status(404).send({ error: '分组不存在' });
    }

    // 将该分组下的人物移出（groupId 设为 null）
    await prisma.person.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });

    await prisma.personGroup.delete({ where: { id } });

    return { success: true };
  });

  // ==================== 人物路由 ====================

  // 获取所有人物
  fastify.get('/', async (request) => {
    const { userId } = request.user as { userId: string };
    const { groupId, sortBy } = request.query as { groupId?: string; sortBy?: string };

    const where: any = { userId };
    if (groupId) {
      where.groupId = groupId;
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'birthday') {
      orderBy = { birthday: 'asc' };
    }

    const people = await prisma.person.findMany({
      where,
      orderBy,
      include: {
        group: true,
      },
    });

    return people;
  });

  // 获取今日生日的人物
  fastify.get('/birthday/today', async (request) => {
    const { userId } = request.user as { userId: string };
    const today = dayjs().format('MM-DD');

    const people = await prisma.person.findMany({
      where: {
        userId,
        birthday: today,
      },
      include: {
        group: true,
      },
    });

    // 计算年龄
    const currentYear = dayjs().year();
    const peopleWithAge = people.map(person => ({
      ...person,
      age: person.birthYear ? currentYear - person.birthYear : null,
    }));

    return peopleWithAge;
  });

  // 获取即将过生日的人物（未来30天内）
  fastify.get('/birthday/upcoming', async (request) => {
    const { userId } = request.user as { userId: string };

    const people = await prisma.person.findMany({
      where: {
        userId,
        birthday: { not: null },
      },
      include: {
        group: true,
      },
    });

    const today = dayjs();
    const currentYear = today.year();

    // 筛选未来30天内过生日的人
    const upcomingBirthdays = people
      .map(person => {
        if (!person.birthday) return null;

        const [month, day] = person.birthday.split('-').map(Number);
        let birthdayThisYear = dayjs(`${currentYear}-${month}-${day}`);

        // 如果今年生日已过，看明年的
        if (birthdayThisYear.isBefore(today, 'day')) {
          birthdayThisYear = birthdayThisYear.add(1, 'year');
        }

        const daysUntil = birthdayThisYear.diff(today, 'day');

        if (daysUntil <= 30 && daysUntil > 0) {
          return {
            ...person,
            age: person.birthYear ? birthdayThisYear.year() - person.birthYear : null,
            daysUntil,
            birthdayDate: birthdayThisYear.format('YYYY-MM-DD'),
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => (a?.daysUntil || 0) - (b?.daysUntil || 0));

    return upcomingBirthdays;
  });

  // 添加人物
  fastify.post('/', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const data = personSchema.parse(request.body);

    // 如果指定了 groupId，验证分组是否存在
    if (data.groupId) {
      const group = await prisma.personGroup.findFirst({
        where: { id: data.groupId, userId },
      });
      if (!group) {
        return reply.status(400).send({ error: '指定的分组不存在' });
      }
    }

    const person = await prisma.person.create({
      data: {
        ...data,
        userId,
      },
      include: {
        group: true,
      },
    });

    return person;
  });

  // 获取单个人物
  fastify.get('/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };

    const person = await prisma.person.findFirst({
      where: { id, userId },
      include: {
        group: true,
      },
    });

    if (!person) {
      return reply.status(404).send({ error: '人物不存在' });
    }

    // 计算年龄
    const currentYear = dayjs().year();
    const personWithAge = {
      ...person,
      age: person.birthYear ? currentYear - person.birthYear : null,
    };

    return personWithAge;
  });

  // 更新人物
  fastify.put('/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const data = personSchema.partial().parse(request.body);

    const person = await prisma.person.findFirst({
      where: { id, userId },
    });

    if (!person) {
      return reply.status(404).send({ error: '人物不存在' });
    }

    // 如果指定了 groupId，验证分组是否存在
    if (data.groupId) {
      const group = await prisma.personGroup.findFirst({
        where: { id: data.groupId, userId },
      });
      if (!group) {
        return reply.status(400).send({ error: '指定的分组不存在' });
      }
    }

    const updated = await prisma.person.update({
      where: { id },
      data,
      include: {
        group: true,
      },
    });

    return updated;
  });

  // 删除人物
  fastify.delete('/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };

    const person = await prisma.person.findFirst({
      where: { id, userId },
    });

    if (!person) {
      return reply.status(404).send({ error: '人物不存在' });
    }

    await prisma.person.delete({ where: { id } });

    return { success: true };
  });

  // 搜索人物
  fastify.get('/search', async (request) => {
    const { userId } = request.user as { userId: string };
    const { keyword } = request.query as { keyword?: string };

    if (!keyword || keyword.trim() === '') {
      return [];
    }

    const people = await prisma.person.findMany({
      where: {
        userId,
        name: {
          contains: keyword,
          mode: 'insensitive',
        },
      },
      include: {
        group: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return people;
  });
}
