import nodemailer from 'nodemailer';
let transport;
export const mailEnabled = () => !!process.env.SMTP_HOST;
export async function sendMail({ to, subject, html, attachments }) {
  if (!mailEnabled()) return false;
  const port = Number(process.env.SMTP_PORT) || 587;
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, html, attachments });
  return true;
}
