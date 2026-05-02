import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/mailer';
import { todayString, daysBetween } from '@stillalive/core';

// 每天 09:00 检查死亡确认
export function startDeathConfirmationJob() {
  cron.schedule('0 9 * * *', async () => {
    const today = todayString();
    const confirmations = await prisma.deathConfirmation.findMany({
      where: { enabled: true, emergencyEmail: { not: '' } },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            checkIns: {
              orderBy: { date: 'desc' },
              take: 1,
              select: { date: true },
            },
          },
        },
      },
    });

    for (const dc of confirmations) {
      const last = dc.user.checkIns[0];
      if (!last) continue;
      const days = daysBetween(last.date, today);
      if (days >= dc.triggerDays) {
        const nickname = dc.user.nickname ?? '一位用户';
        const text = `你好，\n\n用户 ${nickname} 已连续 ${days} 天未在「还活着」应用中确认存活。\n\n这封邮件并不意味着什么，但如果方便的话，请确认 TA 是否安好。\n\n—— 来自「还活着」`;
        await sendEmail(dc.emergencyEmail, `关于 ${nickname} 的生存确认`, text);
        console.log(`[CRON] death-confirmation sent for user ${dc.userId}`);
      }
    }
  });
  console.log('[CRON] death-confirmation job scheduled at 09:00');
}

// 每天 21:00 打卡提醒（占位，实际推送依赖客户端）
export function startReminderJob() {
  cron.schedule('0 21 * * *', async () => {
    const today = todayString();
    const usersNotChecked = await prisma.user.findMany({
      where: { checkIns: { none: { date: today } } },
      select: { id: true, nickname: true, email: true },
    });
    console.log(`[CRON] reminder: ${usersNotChecked.length} users need reminder`);
  });
}

export function startAllJobs() {
  startDeathConfirmationJob();
  startReminderJob();
}
