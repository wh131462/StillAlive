import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../lib/response';
import { env } from '../config/env';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      success: false,
      data: null,
      message: err.message,
      code: err.code,
    });
    return;
  }

  if (env.isDev) {
    console.error(err);
  }

  res.status(500).json({
    success: false,
    data: null,
    message: env.isDev ? err.message : '服务器内部错误',
    code: 'INTERNAL_ERROR',
  });
}
