import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';

const prisma = new PrismaClient();

// ==================== Schema 定义 ====================

const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少6个字符'),
  nickname: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
});

const verifyResetCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, '验证码为6位数字'),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(6, '密码至少6个字符'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// ==================== 辅助函数 ====================

// 生成6位数字验证码
function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 生成刷新Token
function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

// Token过期时间配置
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 访问Token 15分钟
const REFRESH_TOKEN_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000; // 刷新Token 7天
const RESET_CODE_EXPIRES_IN_MS = 10 * 60 * 1000; // 验证码 10分钟

// ==================== 路由定义 ====================

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
          avatar: true,
          createdAt: true,
        },
      });

      // 创建默认人物分组
      await prisma.personGroup.createMany({
        data: [
          { userId: user.id, name: '家人', icon: 'house-heart', color: 'rose', sortOrder: 0 },
          { userId: user.id, name: '朋友', icon: 'user-group', color: 'blue', sortOrder: 1 },
          { userId: user.id, name: '同事', icon: 'briefcase', color: 'amber', sortOrder: 2 },
          { userId: user.id, name: '其他', icon: 'ellipsis', color: 'slate', sortOrder: 3 },
        ],
      });

      // 生成访问Token和刷新Token
      const accessToken = fastify.jwt.sign({ userId: user.id }, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
      const refreshToken = generateRefreshToken();

      // 保存刷新Token
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS),
        },
      });

      return { user, accessToken, refreshToken };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message });
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

      // 生成访问Token和刷新Token
      const accessToken = fastify.jwt.sign({ userId: user.id }, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
      const refreshToken = generateRefreshToken();

      // 保存刷新Token
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS),
        },
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          avatar: user.avatar,
          createdAt: user.createdAt,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message });
      }
      throw error;
    }
  });

  // 刷新Token
  fastify.post('/refresh-token', async (request, reply) => {
    try {
      const { refreshToken } = refreshTokenSchema.parse(request.body);

      // 查找刷新Token
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken) {
        return reply.status(401).send({ error: '无效的刷新Token' });
      }

      // 检查是否过期
      if (storedToken.expiresAt < new Date()) {
        // 删除过期Token
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        return reply.status(401).send({ error: '刷新Token已过期，请重新登录' });
      }

      // 删除旧的刷新Token
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });

      // 生成新的Token
      const newAccessToken = fastify.jwt.sign(
        { userId: storedToken.userId },
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
      );
      const newRefreshToken = generateRefreshToken();

      // 保存新的刷新Token
      await prisma.refreshToken.create({
        data: {
          userId: storedToken.userId,
          token: newRefreshToken,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS),
        },
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message });
      }
      throw error;
    }
  });

  // 忘记密码 - 发送验证码
  fastify.post('/forgot-password', async (request, reply) => {
    try {
      const { email } = forgotPasswordSchema.parse(request.body);

      // 查找用户
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // 为了安全，即使用户不存在也返回成功
        return { message: '如果该邮箱已注册，验证码已发送' };
      }

      // 生成验证码
      const code = generateResetCode();
      const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRES_IN_MS);

      // 将之前未使用的验证码标记为已使用
      await prisma.passwordReset.updateMany({
        where: { userId: user.id, isUsed: false },
        data: { isUsed: true },
      });

      // 保存新验证码
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          code,
          expiresAt,
        },
      });

      // TODO: 发送邮件
      // 开发环境下，直接在响应中返回验证码（生产环境应该发送邮件）
      if (process.env.NODE_ENV !== 'production') {
        return { message: '验证码已发送', code }; // 开发环境返回验证码
      }

      // 生产环境 - 发送邮件逻辑
      // await sendResetCodeEmail(email, code);

      return { message: '如果该邮箱已注册，验证码已发送' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message });
      }
      throw error;
    }
  });

  // 验证重置码
  fastify.post('/verify-reset-code', async (request, reply) => {
    try {
      const { email, code } = verifyResetCodeSchema.parse(request.body);

      // 查找用户
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return reply.status(400).send({ error: '验证码无效或已过期' });
      }

      // 查找有效的验证码
      const resetRecord = await prisma.passwordReset.findFirst({
        where: {
          userId: user.id,
          code,
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!resetRecord) {
        return reply.status(400).send({ error: '验证码无效或已过期' });
      }

      return { valid: true, message: '验证码有效' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message });
      }
      throw error;
    }
  });

  // 重置密码
  fastify.post('/reset-password', async (request, reply) => {
    try {
      const { email, code, newPassword } = resetPasswordSchema.parse(request.body);

      // 查找用户
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return reply.status(400).send({ error: '验证码无效或已过期' });
      }

      // 查找有效的验证码
      const resetRecord = await prisma.passwordReset.findFirst({
        where: {
          userId: user.id,
          code,
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!resetRecord) {
        return reply.status(400).send({ error: '验证码无效或已过期' });
      }

      // 加密新密码
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 更新密码
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      // 标记验证码为已使用
      await prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { isUsed: true },
      });

      // 清除该用户所有的刷新Token（强制重新登录）
      await prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      });

      return { message: '密码重置成功，请重新登录' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message });
      }
      throw error;
    }
  });

  // 登出（可选 - 删除刷新Token）
  fastify.post('/logout', async (request, reply) => {
    try {
      const { refreshToken } = refreshTokenSchema.parse(request.body);

      // 删除刷新Token
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });

      return { message: '已成功登出' };
    } catch (error) {
      return { message: '已成功登出' };
    }
  });
}
