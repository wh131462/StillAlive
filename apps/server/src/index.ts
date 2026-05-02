import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './config/env';
import { errorHandler } from './middleware/error';
import { authRouter } from './modules/auth/auth.router';
import { checkinRouter } from './modules/checkin/checkin.router';
import { personRouter, personGroupRouter } from './modules/person/person.router';
import { storyRouter } from './modules/story/story.router';
import { profileRouter } from './modules/profile/profile.router';
import { uploadRouter } from './modules/upload/upload.router';
import { startAllJobs } from './jobs';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, env: env.nodeEnv, time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/checkins', checkinRouter);
app.use('/api/people', personRouter);
app.use('/api/person-groups', personGroupRouter);
app.use('/api/stories', storyRouter);
app.use('/api/profile', profileRouter);
app.use('/api/upload', uploadRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, data: null, message: 'Not found' });
});
app.use(errorHandler);

const PORT = env.port;
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  if (!env.isDev) {
    startAllJobs();
  } else {
    console.log('[server] cron jobs disabled in dev mode (set NODE_ENV=production to enable)');
  }
});
