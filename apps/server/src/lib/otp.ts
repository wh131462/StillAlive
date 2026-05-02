// 验证码服务：开发期内存实现，生产替换为 Redis
import { errors } from "./response";
import { env } from "../config/env";

interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
}

const store = new Map<string, OtpRecord>();
const sendLog = new Map<string, number>(); // 发送频率限制

const TTL_MS = 5 * 60 * 1000; // 5 分钟
const SEND_INTERVAL_MS = 60 * 1000; // 60 秒频率限制
const MAX_ATTEMPTS = 5;

const DEV_CODE = "123456";

function generate(): string {
  if (env.isDev) return DEV_CODE;
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function send(target: string, scene: string): string {
  const key = `${scene}:${target}`;
  const last = sendLog.get(key);
  if (last && Date.now() - last < SEND_INTERVAL_MS) {
    throw errors.tooManyRequests("请求过于频繁，请稍后重试");
  }
  const code = generate();
  store.set(key, { code, expiresAt: Date.now() + TTL_MS, attempts: 0 });
  sendLog.set(key, Date.now());
  return code;
}

export function verify(target: string, scene: string, code: string): boolean {
  const key = `${scene}:${target}`;
  const record = store.get(key);
  if (!record) return false;
  if (record.expiresAt < Date.now()) {
    store.delete(key);
    return false;
  }
  record.attempts++;
  if (record.attempts > MAX_ATTEMPTS) {
    store.delete(key);
    return false;
  }
  if (record.code !== code) return false;
  store.delete(key);
  return true;
}
