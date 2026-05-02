import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../../config/env';
import { errors } from '../../lib/response';

const JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export const appleService = {
  async verifyIdentityToken(identityToken: string): Promise<string> {
    if (!env.apple.clientId) {
      throw errors.badRequest('Apple 登录未配置');
    }
    try {
      const { payload } = await jwtVerify(identityToken, JWKS, {
        issuer: 'https://appleid.apple.com',
        audience: env.apple.clientId,
      });
      if (!payload.sub) throw errors.unauthorized('Apple token 缺少 sub');
      return payload.sub as string;
    } catch (err) {
      if (err instanceof Error) {
        throw errors.unauthorized(`Apple token 验证失败: ${err.message}`);
      }
      throw errors.unauthorized('Apple token 验证失败');
    }
  },
};
