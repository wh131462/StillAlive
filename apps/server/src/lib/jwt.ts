import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from './prisma';
import { errors } from './response';

export interface AccessTokenPayload {
  sub: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  jti: string;
}

export function signAccessToken(userId: string): { token: string; expiresIn: number } {
  const expiresIn = parseExpiry(env.jwt.expiresIn);
  const token = jwt.sign({ sub: userId, type: 'access' }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
  return { token, expiresIn };
}

export async function signRefreshToken(userId: string, device?: string): Promise<string> {
  const expiresAt = new Date(Date.now() + parseExpiry(env.jwt.refreshExpiresIn) * 1000);
  const record = await prisma.refreshToken.create({
    data: {
      userId,
      device,
      token: '', // placeholder until we have id
      expiresAt,
    },
  });
  const token = jwt.sign(
    { sub: userId, type: 'refresh', jti: record.id },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'] },
  );
  await prisma.refreshToken.update({ where: { id: record.id }, data: { token } });
  return token;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.jwt.secret) as AccessTokenPayload;
    if (payload.type !== 'access') throw errors.unauthorized('Token 类型错误');
    return payload;
  } catch {
    throw errors.unauthorized();
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
  } catch {
    throw errors.unauthorized('Refresh token 无效');
  }
  if (payload.type !== 'refresh') throw errors.unauthorized('Token 类型错误');

  const record = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!record || record.token !== token || record.expiresAt < new Date()) {
    throw errors.unauthorized('Refresh token 已失效');
  }
  return payload;
}

export async function revokeRefreshToken(jti: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { id: jti } });
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

function parseExpiry(value: string): number {
  // returns seconds
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const n = parseInt(match[1]!, 10);
  const u = match[2];
  switch (u) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default: return 900;
  }
}
