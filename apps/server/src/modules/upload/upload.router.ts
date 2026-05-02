import { Router } from 'express';
import OSS from 'ali-oss';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async';
import { ok } from '../../lib/response';
import { errors } from '../../lib/response';
import { env } from '../../config/env';

export const uploadRouter = Router();
uploadRouter.use(authenticate);

uploadRouter.post('/sign', asyncHandler(async (req, res) => {
  if (!env.oss.bucket || !env.oss.accessKeyId) {
    throw errors.badRequest('OSS 未配置（开发期可使用本地 mock）');
  }
  const client = new OSS({
    region: env.oss.region,
    accessKeyId: env.oss.accessKeyId,
    accessKeySecret: env.oss.accessKeySecret,
    bucket: env.oss.bucket,
  });
  const filename = req.body.filename || `${req.userId}/${Date.now()}`;
  const key = `uploads/${req.userId}/${filename}`;
  const url = client.signatureUrl(key, {
    method: 'PUT',
    expires: 600,
    'Content-Type': req.body.contentType || 'application/octet-stream',
  });
  ok(res, {
    uploadUrl: url,
    publicUrl: `https://${env.oss.bucket}.${env.oss.region}.aliyuncs.com/${key}`,
    key,
  });
}));
