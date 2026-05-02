import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

function optional(key: string, fallback = ''): string {
  return process.env[key] || fallback;
}

export const env = {
  port: parseInt(optional('PORT', '3001'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  isDev: optional('NODE_ENV', 'development') === 'development',

  databaseUrl: required('DATABASE_URL'),
  redisUrl: optional('REDIS_URL', 'redis://localhost:6379'),

  jwt: {
    secret: required('JWT_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  wechat: {
    appId: optional('WECHAT_APP_ID'),
    appSecret: optional('WECHAT_APP_SECRET'),
    miniAppId: optional('WECHAT_MINI_APP_ID'),
    miniAppSecret: optional('WECHAT_MINI_APP_SECRET'),
  },

  apple: {
    clientId: optional('APPLE_CLIENT_ID'),
    teamId: optional('APPLE_TEAM_ID'),
    keyId: optional('APPLE_KEY_ID'),
    privateKey: optional('APPLE_PRIVATE_KEY'),
  },

  oss: {
    region: optional('OSS_REGION'),
    accessKeyId: optional('OSS_ACCESS_KEY_ID'),
    accessKeySecret: optional('OSS_ACCESS_KEY_SECRET'),
    bucket: optional('OSS_BUCKET'),
  },

  smtp: {
    host: optional('SMTP_HOST'),
    port: parseInt(optional('SMTP_PORT', '465'), 10),
    user: optional('SMTP_USER'),
    pass: optional('SMTP_PASS'),
    from: optional('SMTP_FROM'),
  },
};
