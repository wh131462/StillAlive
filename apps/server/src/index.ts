import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { authRoutes } from './routes/auth.js';
import { checkinRoutes } from './routes/checkin.js';
import { peopleRoutes } from './routes/people.js';
import { userRoutes } from './routes/user.js';
import { syncRoutes } from './routes/sync.js';
import { dailyInfoRoutes } from './routes/daily-info.js';
import { premiumRoutes } from './routes/premium.js';
import { startDeathConfirmationJob } from './jobs/deathConfirmation.js';

const fastify = Fastify({
  logger: true,
});

// 注册插件
await fastify.register(cors, {
  origin: true,
  credentials: true,
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'still-alive-secret-key',
});

await fastify.register(cookie);

// 注册路由
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(checkinRoutes, { prefix: '/api/checkin' });
await fastify.register(peopleRoutes, { prefix: '/api/people' });
await fastify.register(userRoutes, { prefix: '/api/user' });
await fastify.register(syncRoutes, { prefix: '/api/sync' });
await fastify.register(dailyInfoRoutes, { prefix: '/api/daily-info' });
await fastify.register(premiumRoutes, { prefix: '/api/premium' });

// 健康检查
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// 启动服务器
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 4000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Server running at http://localhost:${port}`);

    // 启动死亡确认定时任务
    if (process.env.ENABLE_DEATH_CONFIRMATION !== 'false') {
      startDeathConfirmationJob();
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
