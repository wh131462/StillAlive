// 统一 API 响应包装
import type { Response } from 'express';

export interface ApiOk<T> {
  success: true;
  data: T;
  message: null;
  meta?: { total: number; page: number; limit: number };
}

export interface ApiErr {
  success: false;
  data: null;
  message: string;
  code?: string;
}

export function ok<T>(res: Response, data: T, meta?: ApiOk<T>['meta']): Response {
  const body: ApiOk<T> = { success: true, data, message: null };
  if (meta) body.meta = meta;
  return res.json(body);
}

export function created<T>(res: Response, data: T): Response {
  return res.status(201).json({ success: true, data, message: null });
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const errors = {
  badRequest: (message: string, code = 'BAD_REQUEST') => new ApiError(400, message, code),
  unauthorized: (message = '未登录或登录已过期', code = 'UNAUTHORIZED') => new ApiError(401, message, code),
  forbidden: (message = '无权限', code = 'FORBIDDEN') => new ApiError(403, message, code),
  notFound: (message = '资源不存在', code = 'NOT_FOUND') => new ApiError(404, message, code),
  conflict: (message: string, code = 'CONFLICT') => new ApiError(409, message, code),
  tooManyRequests: (message = '操作过于频繁', code = 'RATE_LIMIT') => new ApiError(429, message, code),
};
