import type {
  AuthTokens,
  LoginByEmailRequest,
  LoginByPhoneRequest,
  LoginByWechatRequest,
  LoginByAppleRequest,
  RegisterRequest,
  User,
} from '@stillalive/types';
import type { HttpClient } from '../client';

export class AuthApi {
  constructor(private http: HttpClient) {}

  loginByPhone(data: LoginByPhoneRequest) {
    return this.http.post<AuthTokens>('/auth/login/phone', data);
  }

  loginByEmail(data: LoginByEmailRequest) {
    return this.http.post<AuthTokens>('/auth/login/email', data);
  }

  loginByWechat(data: LoginByWechatRequest) {
    return this.http.post<AuthTokens>('/auth/login/wechat', data);
  }

  loginByApple(data: LoginByAppleRequest) {
    return this.http.post<AuthTokens>('/auth/login/apple', data);
  }

  register(data: RegisterRequest) {
    return this.http.post<AuthTokens>('/auth/register', data);
  }

  refreshToken(refreshToken: string) {
    return this.http.post<AuthTokens>('/auth/refresh', { refreshToken });
  }

  me() {
    return this.http.get<User>('/auth/me');
  }

  logout() {
    return this.http.post<null>('/auth/logout');
  }
}
