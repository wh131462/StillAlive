import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const updateProfileSchema = z.object({
  nickname: z.string().optional(),
  avatar: z.string().optional(),
});

const emergencyConfigSchema = z.object({
  email: z.string().email(),
  triggerDays: z.number().min(1).max(30),
  isEnabled: z.boolean().optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  // 认证中间件
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: '未授权' });
    }
  });

  // 获取当前用户信息
  fastify.get('/me', async (request) => {
    const { userId } = request.user as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatar: true,
        createdAt: true,
      },
    });

    return user;
  });

  // 更新用户信息
  fastify.put('/me', async (request) => {
    const { userId } = request.user as { userId: string };
    const data = updateProfileSchema.parse(request.body);

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        nickname: true,
        avatar: true,
      },
    });

    return user;
  });

  // 获取紧急联系人配置
  fastify.get('/emergency-config', async (request) => {
    const { userId } = request.user as { userId: string };

    const config = await prisma.emergencyConfig.findUnique({
      where: { userId },
    });

    return config;
  });

  // 设置紧急联系人配置
  fastify.put('/emergency-config', async (request) => {
    const { userId } = request.user as { userId: string };
    const data = emergencyConfigSchema.parse(request.body);

    const config = await prisma.emergencyConfig.upsert({
      where: { userId },
      update: data,
      create: {
        ...data,
        userId,
      },
    });

    return config;
  });
}
