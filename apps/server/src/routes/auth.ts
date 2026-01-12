import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nickname: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // 注册
  fastify.post('/register', async (request, reply) => {
    try {
      const { email, password, nickname } = registerSchema.parse(request.body);

      // 检查邮箱是否已存在
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return reply.status(400).send({ error: '邮箱已被注册' });
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建用户
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          nickname,
        },
        select: {
          id: true,
          email: true,
          nickname: true,
          createdAt: true,
        },
      });

      // 生成 token
      const token = fastify.jwt.sign({ userId: user.id });

      return { user, token };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      throw error;
    }
  });

  // 登录
  fastify.post('/login', async (request, reply) => {
    try {
      const { email, password } = loginSchema.parse(request.body);

      // 查找用户
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return reply.status(401).send({ error: '邮箱或密码错误' });
      }

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return reply.status(401).send({ error: '邮箱或密码错误' });
      }

      // 生成 token
      const token = fastify.jwt.sign({ userId: user.id });

      return {
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          avatar: user.avatar,
        },
        token,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      throw error;
    }
  });
}
