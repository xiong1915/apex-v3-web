// lib/auth/config.ts
// APEX V3 身份与凭据环境配置

export const AUTH_CONFIG = {
  // Supabase 凭据 (未配置时进入本地兼容 Mock 模式)
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // 管理员安全凭据 (Step 4 唯一管理员安全校验)
  adminUserId: process.env.ADMIN_USER_ID || 'admin-apex-v3-root',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@apex-f1.com',

  // 30 天持久登录体验 (2,592,000 秒)
  sessionMaxAge: 30 * 24 * 60 * 60,

  // Cookie 配置
  cookieName: 'apex_session_token',
  refreshCookieName: 'apex_refresh_token',

  // 邮件服务 (Resend 或 SMTP)
  resendApiKey: process.env.RESEND_API_KEY || '',
  smtpFrom: process.env.SMTP_FROM || 'APEX V3 <noreply@tike69.cc.cd>'
};

export function isSupabaseConfigured(): boolean {
  return Boolean(
    AUTH_CONFIG.supabaseUrl &&
    AUTH_CONFIG.supabaseAnonKey &&
    !AUTH_CONFIG.supabaseUrl.includes('example.supabase.co')
  );
}

export function isMockAuthEnabled(): boolean {
  if (process.env.MOCK_AUTH === 'true') return true;
  return !isSupabaseConfigured();
}
