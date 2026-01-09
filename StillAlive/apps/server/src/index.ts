import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { authRoutes } from './routes/auth.js';
import { checkinRoutes } from './routes/checkin.js';
import { peopleRoutes } from './routes/people.js';
import { userRoutes } from './routes/user.js';

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
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
