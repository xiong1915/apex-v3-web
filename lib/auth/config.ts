// lib/auth/config.ts
// APEX V3 身份与凭据环境配置

export const AUTH_CONFIG = {
  // Supabase 凭据
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // 管理员安全凭据 (必须由 ADMIN_USER_ID 指定真实 Supabase UUID，严禁预置默认值)
  adminUserId: process.env.ADMIN_USER_ID?.trim() || '',
  adminEmail: process.env.ADMIN_EMAIL?.trim() || '',

  // 30 天持久登录体验 (2,592,000 秒)
  sessionMaxAge: 30 * 24 * 60 * 60,

  // Cookie 配置
  cookieName: 'apex_session_token',
  refreshCookieName: 'apex_refresh_token',
  sessionCreatedAtCookieName: 'apex_session_created_at',

  // 邮件服务 (Resend API 与 Supabase SMTP 隔离)
  resendApiKey: process.env.RESEND_API_KEY || '',
  smtpFrom: process.env.SMTP_FROM || 'APEX V3 <noreply@tike69.cc.cd>'
};

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id.trim());
}

export function isProduction(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.VERCEL === '1'
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    AUTH_CONFIG.supabaseUrl &&
    AUTH_CONFIG.supabaseAnonKey &&
    !AUTH_CONFIG.supabaseUrl.includes('example.supabase.co')
  );
}

export function isMockAuthAllowed(): boolean {
  // 生产环境无论配置状态如何，彻底禁止 Mock 认证
  if (isProduction()) return false;
  return process.env.MOCK_AUTH !== 'false';
}

export function isMockAuthEnabled(): boolean {
  return isMockAuthAllowed() && !isSupabaseConfigured();
}
