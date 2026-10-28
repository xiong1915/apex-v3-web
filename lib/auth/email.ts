// lib/auth/email.ts
// APEX V3 邮件服务接入 (优先 Resend Free API，支持通用 SMTP，无外网凭据时安全落盘与 Mock 收集)

import nodemailer from 'nodemailer';
import { AUTH_CONFIG } from './config';
import { mockAuthManager } from './mock';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail({
  to,
  subject,
  htmlText
}: {
  to: string;
  subject: string;
  htmlText: string;
}): Promise<EmailSendResult> {
  // 1. 如果配置了通用 SMTP (如 QQ 邮箱、163 邮箱、企业邮)
  if (AUTH_CONFIG.smtpHost && AUTH_CONFIG.smtpUser && AUTH_CONFIG.smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: AUTH_CONFIG.smtpHost,
        port: AUTH_CONFIG.smtpPort,
        secure: AUTH_CONFIG.smtpSecure,
        auth: {
          user: AUTH_CONFIG.smtpUser,
          pass: AUTH_CONFIG.smtpPass
        }
      });

      const info = await transporter.sendMail({
        from: AUTH_CONFIG.smtpFrom || AUTH_CONFIG.smtpUser,
        to,
        subject,
        html: htmlText
      });

      return { success: true, messageId: info.messageId };
    } catch (e: any) {
      console.warn('[Email] SMTP error:', e);
      return { success: false, error: e.message || 'SMTP 发信失败' };
    }
  }

  // 2. 如果配置了 Resend API
  if (AUTH_CONFIG.resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTH_CONFIG.resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: AUTH_CONFIG.smtpFrom,
          to: [to],
          subject,
          html: htmlText
        })
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, messageId: data.id };
      } else {
        const errJson = await res.json().catch(() => null);
        console.warn('[Email] Resend API error:', errJson);
        return { success: false, error: errJson?.message || 'Resend 发送失败' };
      }
    } catch (e: any) {
      console.warn('[Email] Network error contacting Resend:', e);
      return { success: false, error: e.message };
    }
  }

  // 2. 本地/预览安全 Mock 模式
  console.log(`[Email Mock] To: ${to} | Subject: ${subject}`);
  return { success: true, messageId: `mock_email_${Date.now()}` };
}

export async function sendVerificationEmail(to: string, confirmUrl: string): Promise<EmailSendResult> {
  const subject = '【APEX V3】请验证您的注册邮箱';
  const htmlText = `
    <div style="background:#0a0a0b; color:#fff; padding:32px; font-family:sans-serif; border-radius:12px;">
      <h2 style="color:#ff2d20; margin-bottom:16px;">欢迎加入 APEX V3 赛车智能平台</h2>
      <p style="color:#a1a1aa; font-size:14px; line-height:1.6;">
        请点击下方链接完成您的邮箱验证。验证完成后即可畅享 2026 赛季赛事实时动态与 AI 智能策略分析。
      </p>
      <div style="margin:28px 0;">
        <a href="${confirmUrl}" style="background:#ff2d20; color:#fff; padding:12px 24px; border-radius:9999px; text-decoration:none; font-weight:bold; font-size:14px; display:inline-block;">
          验证我的邮箱
        </a>
      </div>
      <p style="color:#71717a; font-size:12px;">如果上方按钮无法点击，请复制并在浏览器打开：${confirmUrl}</p>
      <hr style="border:none; border-top:1px solid #27272a; margin:24px 0;" />
      <p style="color:#52525b; font-size:11px;">此邮件由系统自动发送，如非本人操作请忽略。</p>
    </div>
  `;
  return sendEmail({ to, subject, htmlText });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<EmailSendResult> {
  const subject = '【APEX V3】重置您的账号密码';
  const htmlText = `
    <div style="background:#0a0a0b; color:#fff; padding:32px; font-family:sans-serif; border-radius:12px;">
      <h2 style="color:#ff2d20; margin-bottom:16px;">APEX V3 密码重置请求</h2>
      <p style="color:#a1a1aa; font-size:14px; line-height:1.6;">
        我们收到了您账号的密码重置申请。链接有效期为 1 小时，请点击下方按钮完成重置：
      </p>
      <div style="margin:28px 0;">
        <a href="${resetUrl}" style="background:#ff2d20; color:#fff; padding:12px 24px; border-radius:9999px; text-decoration:none; font-weight:bold; font-size:14px; display:inline-block;">
          设置新密码
        </a>
      </div>
      <p style="color:#71717a; font-size:12px;">如果上方按钮无法点击，请复制并在浏览器打开：${resetUrl}</p>
      <hr style="border:none; border-top:1px solid #27272a; margin:24px 0;" />
      <p style="color:#52525b; font-size:11px;">如果非您本人申请，请忽略此邮件，您的密码不会被更改。</p>
    </div>
  `;
  return sendEmail({ to, subject, htmlText });
}
