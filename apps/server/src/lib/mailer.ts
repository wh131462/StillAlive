import nodemailer from 'nodemailer';
import { env } from '../config/env';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const t = getTransporter();
  if (!t) {
    console.log(`[EMAIL MOCK] to=${to} subject=${subject}`);
    console.log(text);
    return { mocked: true };
  }
  return t.sendMail({
    from: env.smtp.from || env.smtp.user,
    to,
    subject,
    text,
    html: html ?? text,
  });
}
