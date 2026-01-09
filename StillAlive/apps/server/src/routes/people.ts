import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

const personSchema = z.object({
  name: z.string().min(1),
  gender: z.string().optional(),
  birthday: z.string().optional(), // MM-DD
  birthYear: z.number().optional(),
  photo: z.string().optional(),
  mbti: z.string().optional(),
  impression: z.string().optional(),
  experience: z.string().optional(),
});

export async function peopleRoutes(fastify: FastifyInstance) {
  // 认证中间件
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: '未授权' });
    }
  });

  // 获取所有人物
  fastify.get('/', async (request) => {
    const { userId } = request.user as { userId: string };

    const people = await prisma.person.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
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
    });

    return people;
  });

  // 添加人物
  fastify.post('/', async (request) => {
    const { userId } = request.user as { userId: string };
    const data = personSchema.parse(request.body);

    const person = await prisma.person.create({
      data: {
        ...data,
        userId,
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
    });

    if (!person) {
      return reply.status(404).send({ error: '人物不存在' });
    }

    return person;
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

    const updated = await prisma.person.update({
      where: { id },
      data,
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
}
