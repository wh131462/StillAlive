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
  // 'app' 走开放平台 unionid；'mini' 走小程序 openid
  source?: "app" | "mini";
}

export interface LoginByAppleRequest {
  identityToken: string;
  authorizationCode: string;
  nickname?: string;
}

export interface RegisterRequest {
  phone?: string;
  email?: string;
  password?: string;
  smsCode?: string;
  nickname?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface SendSmsRequest {
  phone: string;
  scene: "register" | "login" | "reset";
}

export interface SendEmailCodeRequest {
  email: string;
  scene: "register" | "login" | "reset";
}

export interface ResetPasswordRequest {
  phone?: string;
  email?: string;
  code: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  nickname?: string;
  avatarUrl?: string;
}

export interface DeathConfirmation {
  id: string;
  userId: string;
  triggerDays: number;
  emergencyEmail: string;
  enabled: boolean;
}

export interface UpdateDeathConfirmationRequest {
  triggerDays?: number;
  emergencyEmail?: string;
  enabled?: boolean;
}
