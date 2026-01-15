/**
 * 死亡确认任务
 * 定时检查未打卡用户，发送通知邮件给紧急联系人
 */

import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import {
  sendEmail,
  generateDeathConfirmationEmail,
  generateCheckinReminderEmail,
} from '../lib/email.js';

const prisma = new PrismaClient();

// 配置
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 小时检查一次
const MIN_NOTIFICATION_INTERVAL_DAYS = 3; // 最少间隔 3 天才再次通知
const PRE_WARNING_DAYS = 2; // 提前 2 天警告用户

interface UserCheckinStatus {
  userId: string;
  userName: string;
  userEmail: string;
  emergencyEmail: string;
  triggerDays: number;
  lastCheckinDate: Date | null;
  daysSinceLastCheckin: number;
  lastNotifiedAt: Date | null;
}

/**
 * 获取需要处理的用户列表
 */
async function getUsersToProcess(): Promise<UserCheckinStatus[]> {
  // 获取所有启用了紧急联系人功能的用户
  const usersWithConfig = await prisma.user.findMany({
    where: {
      emergencyConfig: {
        isEnabled: true,
      },
    },
    include: {
      emergencyConfig: true,
      checkins: {
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
  });

  const result: UserCheckinStatus[] = [];
  const today = dayjs().startOf('day');

  for (const user of usersWithConfig) {
    if (!user.emergencyConfig) continue;

    const lastCheckin = user.checkins[0];
    const lastCheckinDate = lastCheckin?.date || null;

    let daysSinceLastCheckin: number;
    if (lastCheckinDate) {
      daysSinceLastCheckin = today.diff(dayjs(lastCheckinDate), 'day');
    } else {
      // 从注册日开始计算
      daysSinceLastCheckin = today.diff(dayjs(user.createdAt), 'day');
    }

    result.push({
      userId: user.id,
      userName: user.nickname || user.email.split('@')[0],
      userEmail: user.email,
      emergencyEmail: user.emergencyConfig.email,
      triggerDays: user.emergencyConfig.triggerDays,
      lastCheckinDate,
      daysSinceLastCheckin,
      lastNotifiedAt: user.emergencyConfig.lastNotifiedAt,
    });
  }

  return result;
}

/**
 * 处理单个用户
 */
async function processUser(user: UserCheckinStatus): Promise<void> {
  const {
    userId,
    userName,
    userEmail,
    emergencyEmail,
    triggerDays,
    lastCheckinDate,
    daysSinceLastCheckin,
    lastNotifiedAt,
  } = user;

  console.log(`📋 检查用户: ${userName} (${userEmail})`);
  console.log(`   最后打卡: ${lastCheckinDate ? dayjs(lastCheckinDate).format('YYYY-MM-DD') : '从未'}`);
  console.log(`   未打卡天数: ${daysSinceLastCheckin}/${triggerDays}`);

  // 情况1: 提前警告用户（接近触发日期）
  const daysUntilTrigger = triggerDays - daysSinceLastCheckin;
  if (daysUntilTrigger > 0 && daysUntilTrigger <= PRE_WARNING_DAYS) {
    console.log(`   ⚠️ 即将触发通知，发送提醒邮件给用户`);

    const html = generateCheckinReminderEmail({
      userName,
      daysSinceLastCheckin,
      triggerDays,
    });

    await sendEmail({
      to: userEmail,
      subject: `[StillAlive] 👋 您已 ${daysSinceLastCheckin} 天未打卡`,
      html,
    });
  }

  // 情况2: 达到触发天数，通知紧急联系人
  if (daysSinceLastCheckin >= triggerDays) {
    // 检查是否需要重复通知
    const shouldNotify = !lastNotifiedAt ||
      dayjs().diff(dayjs(lastNotifiedAt), 'day') >= MIN_NOTIFICATION_INTERVAL_DAYS;

    if (shouldNotify) {
      console.log(`   🚨 触发死亡确认，通知紧急联系人: ${emergencyEmail}`);

      const html = generateDeathConfirmationEmail({
        userName,
        userEmail,
        lastCheckinDate: lastCheckinDate
          ? dayjs(lastCheckinDate).format('YYYY年MM月DD日')
          : '从未打卡',
        daysSinceLastCheckin,
      });

      const sent = await sendEmail({
        to: emergencyEmail,
        subject: `[紧急] ${userName} 已 ${daysSinceLastCheckin} 天未在 StillAlive 打卡`,
        html,
      });

      if (sent) {
        // 更新通知时间
        await prisma.emergencyConfig.update({
          where: { userId },
          data: { lastNotifiedAt: new Date() },
        });
        console.log(`   ✅ 已发送紧急通知`);
      }
    } else {
      console.log(`   ⏭️ 跳过通知 (距上次通知不足 ${MIN_NOTIFICATION_INTERVAL_DAYS} 天)`);
    }
  }
}

/**
 * 执行死亡确认检查
 */
export async function runDeathConfirmationCheck(): Promise<void> {
  console.log('\n========================================');
  console.log('🔍 开始死亡确认检查', new Date().toISOString());
  console.log('========================================\n');

  try {
    const users = await getUsersToProcess();
    console.log(`📊 共 ${users.length} 个用户启用了紧急联系人功能\n`);

    for (const user of users) {
      try {
        await processUser(user);
      } catch (error) {
        console.error(`❌ 处理用户 ${user.userName} 时出错:`, error);
      }
      console.log('---');
    }

    console.log('\n✅ 死亡确认检查完成\n');
  } catch (error) {
    console.error('❌ 死亡确认检查失败:', error);
  }
}

// 定时器 ID
let intervalId: NodeJS.Timeout | null = null;

/**
 * 启动定时任务
 */
export function startDeathConfirmationJob(): void {
  console.log('🚀 启动死亡确认定时任务');
  console.log(`   检查间隔: ${CHECK_INTERVAL_MS / 1000 / 60} 分钟`);

  // 立即执行一次
  runDeathConfirmationCheck();

  // 设置定时执行
  intervalId = setInterval(runDeathConfirmationCheck, CHECK_INTERVAL_MS);
}

/**
 * 停止定时任务
 */
export function stopDeathConfirmationJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('⏹️ 死亡确认定时任务已停止');
  }
}

/**
 * 获取任务状态
 */
export function getJobStatus(): { running: boolean; intervalMs: number } {
  return {
    running: intervalId !== null,
    intervalMs: CHECK_INTERVAL_MS,
  };
}
