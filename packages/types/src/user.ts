export interface User {
  id: string;
  phone: string | null;
  email: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  wechatOpenid: string | null;
  appleId: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginByPhoneRequest {
  phone: string;
  code: string;
}

export interface LoginByEmailRequest {
  email: string;
  password: string;
}

export interface LoginByWechatRequest {
  code: string;
}

export interface LoginByAppleRequest {
  identityToken: string;
  authorizationCode: string;
}

export interface RegisterRequest {
  phone?: string;
  email?: string;
  password?: string;
  smsCode?: string;
  nickname?: string;
}
