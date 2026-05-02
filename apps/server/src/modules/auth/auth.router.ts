import { Router } from 'express';
import { asyncHandler } from '../../middleware/async';
import { authenticate } from '../../middleware/auth';
import { ok, created } from '../../lib/response';
import { authService } from './auth.service';

export const authRouter = Router();

authRouter.post('/send-sms', asyncHandler(async (req, res) => {
  const result = await authService.sendSms(req.body.phone, req.body.scene || 'login');
  ok(res, result);
}));

authRouter.post('/send-email-code', asyncHandler(async (req, res) => {
  const result = await authService.sendEmailCode(req.body.email, req.body.scene || 'login');
  ok(res, result);
}));

authRouter.post('/login/phone', asyncHandler(async (req, res) => {
  const result = await authService.loginByPhone(req.body.phone, req.body.code, req.body.device);
  ok(res, result);
}));

authRouter.post('/login/email', asyncHandler(async (req, res) => {
  const result = await authService.loginByEmail(req.body.email, req.body.password, req.body.device);
  ok(res, result);
}));

authRouter.post('/login/wechat', asyncHandler(async (req, res) => {
  const result = await authService.loginByWechat(req.body.code, req.body.source || 'app', req.body.device);
  ok(res, result);
}));

authRouter.post('/login/apple', asyncHandler(async (req, res) => {
  const result = await authService.loginByApple(req.body.identityToken, req.body.authorizationCode, req.body.nickname, req.body.device);
  ok(res, result);
}));

authRouter.post('/register', asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, req.body.device);
  created(res, result);
}));

authRouter.post('/reset-password', asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);
  ok(res, result);
}));

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const result = await authService.refreshTokens(req.body.refreshToken, req.body.device);
  ok(res, result);
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  const result = await authService.logout(req.body.refreshToken);
  ok(res, result);
}));

authRouter.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await authService.me(req.userId!);
  ok(res, user);
}));

authRouter.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.userId!, req.body);
  ok(res, user);
}));
