import { env } from '../../config/env';
import { errors } from '../../lib/response';

interface WechatTokenResult {
  openid: string;
  unionid?: string;
}

export const wechatService = {
  async exchangeCode(code: string, source: 'app' | 'mini'): Promise<WechatTokenResult> {
    if (source === 'mini') {
      return this.miniProgramLogin(code);
    }
    return this.appLogin(code);
  },

  async appLogin(code: string): Promise<WechatTokenResult> {
    const { appId, appSecret } = env.wechat;
    if (!appId || !appSecret) {
      throw errors.badRequest('微信开放平台未配置');
    }
    const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;
    const res = await fetch(url);
    const data = (await res.json()) as Record<string, unknown>;
    if (data.errcode) {
      throw errors.badRequest(`微信授权失败: ${data.errmsg}`);
    }
    return {
      openid: data.openid as string,
      unionid: data.unionid as string | undefined,
    };
  },

  async miniProgramLogin(code: string): Promise<WechatTokenResult> {
    const { miniAppId, miniAppSecret } = env.wechat;
    if (!miniAppId || !miniAppSecret) {
      throw errors.badRequest('微信小程序未配置');
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${miniAppId}&secret=${miniAppSecret}&js_code=${code}&grant_type=authorization_code`;
    const res = await fetch(url);
    const data = (await res.json()) as Record<string, unknown>;
    if (data.errcode) {
      throw errors.badRequest(`小程序登录失败: ${data.errmsg}`);
    }
    return {
      openid: data.openid as string,
      unionid: data.unionid as string | undefined,
    };
  },
};
