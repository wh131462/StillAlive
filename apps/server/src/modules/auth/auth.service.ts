import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { errors } from '../../lib/response';
import { signAccessToken, signRefreshToken, verifyRefreshToken, revokeRefreshToken, revokeAllUserTokens } from '../../lib/jwt';
import * as otp from '../../lib/otp';
import { wechatService } from './wechat';
import { appleService } from './apple';

const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确');
const emailSchema = z.string().email('邮箱格式不正确');
const passwordSchema = z.string().min(6, '密码至少 6 位').regex(/^(?=.*[A-Za-z])(?=.*\d)/, '密码必须包含字母和数字');
const codeSchema = z.string().length(6, '验证码为 6 位');

async function issueTokens(userId: string, device?: string) {
  const access = signAccessToken(userId);
  const refreshToken = await signRefreshToken(userId, device);
  return {
    accessToken: access.token,
    refreshToken,
    expiresIn: access.expiresIn,
  };
}

function publicUser(user: {
  id: string;
  phone: string | null;
  email: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  wechatOpenid: string | null;
  appleId: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    wechatOpenid: user.wechatOpenid,
    appleId: user.appleId,
    createdAt: user.createdAt.toISOString(),
  };
}

export const authService = {
  async sendSms(phone: string, scene: string) {
    phoneSchema.parse(phone);
    const code = otp.send(phone, scene);
    // 开发期：日志输出，生产替换为短信网关
    console.log(`[OTP] sms ${scene} ${phone}: ${code}`);
    return { sent: true };
  },

  async sendEmailCode(email: string, scene: string) {
    emailSchema.parse(email);
    const code = otp.send(email, scene);
    console.log(`[OTP] email ${scene} ${email}: ${code}`);
    return { sent: true };
  },

  async loginByPhone(phone: string, code: string, device?: string) {
    phoneSchema.parse(phone);
    codeSchema.parse(code);
    if (!otp.verify(phone, 'login', code) && !otp.verify(phone, 'register', code)) {
      throw errors.badRequest('验证码错误或已过期');
    }
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({ data: { phone } });
    }
    const tokens = await issueTokens(user.id, device);
    return { user: publicUser(user), tokens };
  },

  async loginByEmail(email: string, password: string, device?: string) {
    emailSchema.parse(email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw errors.unauthorized('邮箱或密码错误');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw errors.unauthorized('邮箱或密码错误');
    const tokens = await issueTokens(user.id, device);
    return { user: publicUser(user), tokens };
  },

  async loginByWechat(code: string, source: 'app' | 'mini' = 'app', device?: string) {
    const result = await wechatService.exchangeCode(code, source);
    let user;
    if (source === 'mini') {
      user = await prisma.user.findFirst({
        where: result.unionid
          ? { OR: [{ wechatMiniOpenid: result.openid }, { wechatUnionid: result.unionid }] }
          : { wechatMiniOpenid: result.openid },
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            wechatMiniOpenid: result.openid,
            wechatUnionid: result.unionid ?? null,
          },
        });
      }
    } else {
      user = await prisma.user.findFirst({
        where: result.unionid
          ? { OR: [{ wechatOpenid: result.openid }, { wechatUnionid: result.unionid }] }
          : { wechatOpenid: result.openid },
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            wechatOpenid: result.openid,
            wechatUnionid: result.unionid ?? null,
          },
        });
      }
    }
    const tokens = await issueTokens(user.id, device);
    return { user: publicUser(user), tokens };
  },

  async loginByApple(identityToken: string, _authorizationCode: string, nickname?: string, device?: string) {
    const sub = await appleService.verifyIdentityToken(identityToken);
    let user = await prisma.user.findUnique({ where: { appleId: sub } });
    if (!user) {
      user = await prisma.user.create({
        data: { appleId: sub, nickname: nickname ?? null },
      });
    }
    const tokens = await issueTokens(user.id, device);
    return { user: publicUser(user), tokens };
  },

  async register(data: { phone?: string; email?: string; password?: string; smsCode?: string; nickname?: string }, device?: string) {
    let user;
    if (data.phone) {
      phoneSchema.parse(data.phone);
      if (!data.smsCode || !otp.verify(data.phone, 'register', data.smsCode)) {
        throw errors.badRequest('验证码错误或已过期');
      }
      const exists = await prisma.user.findUnique({ where: { phone: data.phone } });
      if (exists) throw errors.conflict('手机号已注册');
      user = await prisma.user.create({
        data: { phone: data.phone, nickname: data.nickname ?? null },
      });
    } else if (data.email && data.password) {
      emailSchema.parse(data.email);
      passwordSchema.parse(data.password);
      const exists = await prisma.user.findUnique({ where: { email: data.email } });
      if (exists) throw errors.conflict('邮箱已注册');
      const passwordHash = await bcrypt.hash(data.password, 10);
      user = await prisma.user.create({
        data: { email: data.email, passwordHash, nickname: data.nickname ?? null },
      });
    } else {
      throw errors.badRequest('注册参数不完整');
    }
    const tokens = await issueTokens(user.id, device);
    return { user: publicUser(user), tokens };
  },

  async resetPassword(data: { phone?: string; email?: string; code: string; newPassword: string }) {
    passwordSchema.parse(data.newPassword);
    let user;
    if (data.phone) {
      if (!otp.verify(data.phone, 'reset', data.code)) {
        throw errors.badRequest('验证码错误或已过期');
      }
      user = await prisma.user.findUnique({ where: { phone: data.phone } });
    } else if (data.email) {
      if (!otp.verify(data.email, 'reset', data.code)) {
        throw errors.badRequest('验证码错误或已过期');
      }
      user = await prisma.user.findUnique({ where: { email: data.email } });
    } else {
      throw errors.badRequest('需提供手机号或邮箱');
    }
    if (!user) throw errors.notFound('账号不存在');
    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await revokeAllUserTokens(user.id);
    return { reset: true };
  },

  async refreshTokens(refreshToken: string, device?: string) {
    const payload = await verifyRefreshToken(refreshToken);
    await revokeRefreshToken(payload.jti);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw errors.unauthorized();
    return await issueTokens(user.id, device);
  },

  async logout(refreshToken?: string) {
    if (!refreshToken) return { logout: true };
    try {
      const payload = await verifyRefreshToken(refreshToken);
      await revokeRefreshToken(payload.jti);
    } catch {
      // ignore
    }
    return { logout: true };
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw errors.notFound('用户不存在');
    return publicUser(user);
  },

  async updateProfile(userId: string, data: { nickname?: string; avatarUrl?: string }) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.nickname !== undefined && { nickname: data.nickname }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
    });
    return publicUser(user);
  },
};
