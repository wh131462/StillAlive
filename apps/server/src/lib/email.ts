/**
 * 邮件服务
 * 使用 nodemailer 发送邮件
 */

import nodemailer from 'nodemailer';

// 邮件配置
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.qq.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * 发送邮件
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const info = await transporter.sendMail({
      from: `"StillAlive" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log('📧 邮件发送成功:', info.messageId);
    return true;
  } catch (error) {
    console.error('📧 邮件发送失败:', error);
    return false;
  }
}

/**
 * 生成死亡确认邮件 HTML
 */
export function generateDeathConfirmationEmail(params: {
  userName: string;
  userEmail: string;
  lastCheckinDate: string;
  daysSinceLastCheckin: number;
  confirmUrl?: string;
}): string {
  const { userName, userEmail, lastCheckinDate, daysSinceLastCheckin } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      padding: 20px 0;
      border-bottom: 2px solid #e0e0e0;
    }
    .header h1 {
      color: #d32f2f;
      margin: 0;
    }
    .content {
      padding: 30px 0;
    }
    .alert-box {
      background: #fff3e0;
      border-left: 4px solid #ff9800;
      padding: 15px 20px;
      margin: 20px 0;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .info-table td {
      padding: 10px;
      border-bottom: 1px solid #e0e0e0;
    }
    .info-table td:first-child {
      color: #666;
      width: 40%;
    }
    .footer {
      text-align: center;
      padding: 20px 0;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #e0e0e0;
    }
    .button {
      display: inline-block;
      background: #1976d2;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚠️ StillAlive 紧急通知</h1>
  </div>

  <div class="content">
    <p>您好，</p>

    <p>您收到此邮件是因为您被设置为 <strong>${userName}</strong> 的紧急联系人。</p>

    <div class="alert-box">
      <strong>重要提醒：</strong> ${userName} 已经 <strong>${daysSinceLastCheckin} 天</strong>没有在 StillAlive 应用中打卡了。
    </div>

    <p>以下是相关信息：</p>

    <table class="info-table">
      <tr>
        <td>用户名</td>
        <td><strong>${userName}</strong></td>
      </tr>
      <tr>
        <td>用户邮箱</td>
        <td>${userEmail}</td>
      </tr>
      <tr>
        <td>最后打卡日期</td>
        <td>${lastCheckinDate || '从未打卡'}</td>
      </tr>
      <tr>
        <td>未打卡天数</td>
        <td><strong>${daysSinceLastCheckin} 天</strong></td>
      </tr>
    </table>

    <p>
      StillAlive 是一款帮助用户记录日常生活的应用。当用户长时间未打卡时，
      系统会自动通知紧急联系人，以确保用户的安全。
    </p>

    <p>
      建议您：
    </p>
    <ul>
      <li>尝试联系 ${userName}，确认其安全状况</li>
      <li>如果无法联系到本人，请通过其他方式确认</li>
      <li>如果确认安全，请提醒 TA 继续使用 StillAlive 打卡</li>
    </ul>

    <p>
      如果这是误报（例如用户正在旅行或休息），请忽略此邮件。
      用户恢复打卡后，系统将不再发送提醒。
    </p>
  </div>

  <div class="footer">
    <p>此邮件由 StillAlive 系统自动发送，请勿直接回复。</p>
    <p>© ${new Date().getFullYear()} StillAlive - 记录每一天，活着</p>
  </div>
</body>
</html>
`;
}

/**
 * 生成提醒用户打卡的邮件
 */
export function generateCheckinReminderEmail(params: {
  userName: string;
  daysSinceLastCheckin: number;
  triggerDays: number;
}): string {
  const { userName, daysSinceLastCheckin, triggerDays } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      padding: 20px 0;
    }
    .header h1 {
      color: #1976d2;
      margin: 0;
    }
    .content {
      padding: 20px 0;
    }
    .highlight {
      background: #e3f2fd;
      padding: 15px 20px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: center;
    }
    .footer {
      text-align: center;
      padding: 20px 0;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>👋 嘿，${userName}！</h1>
  </div>

  <div class="content">
    <p>好久不见！</p>

    <div class="highlight">
      <p>您已经 <strong>${daysSinceLastCheckin} 天</strong>没有打卡了</p>
      <p style="font-size: 14px; color: #666;">
        再过 ${triggerDays - daysSinceLastCheckin} 天，系统将通知您的紧急联系人
      </p>
    </div>

    <p>
      打开 StillAlive，只需轻点一下，就能告诉世界：你还好好的 ✨
    </p>

    <p>
      每一次打卡，都是对生活的一次确认。<br>
      期待您的回归！
    </p>
  </div>

  <div class="footer">
    <p>© ${new Date().getFullYear()} StillAlive</p>
  </div>
</body>
</html>
`;
}
