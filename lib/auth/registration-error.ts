// lib/auth/registration-error.ts
/**
 * 统一模糊化注册失败响应，彻底防止账号枚举攻击；详细错误日志在服务端保留备查
 */
export function registrationError(error: { message?: string; code?: string; status?: number }) {
  const code = error.code || '', message = error.message || '';
  if (code === 'over_email_send_rate_limit' || /email.*rate limit|rate limit.*email/i.test(message)) {
    return { status: 429, code: 'over_email_send_rate_limit', retryAfterSeconds: 60, message: '验证邮件发送已触发限流，请稍后再试。若已收到验证邮件，请先使用原邮件完成验证，无需重复注册。' };
  }
  if (error.status === 429 || code === 'over_request_rate_limit') {
    return { status: 429, code: 'over_request_rate_limit', retryAfterSeconds: 60, message: '注册请求过于频繁，请稍后再试。' };
  }
  if (code === 'email_address_not_authorized') {
    return { status: 503, code, message: '当前邮件服务无法向此邮箱发送验证邮件，请联系管理员处理。' };
  }
  if (code === 'weak_password') {
    return { status: 400, code: 'weak_password', message: '密码强度不足，请使用更长的密码，并组合字母、数字和符号。' };
  }

  // 服务端保留真实原因日志供审计备查，但对外一律返回统一模糊文案，防账号探测
  console.warn('[Auth Register Warning] Detailed registration failure:', { code, message, status: error.status });
  const status = error.status && error.status >= 500 ? 503 : 400;
  return {
    status,
    code: 'registration_failed',
    message: status === 503 ? '注册暂未完成，请稍后重试。若持续失败，请联系管理员。' : '注册未完成，请检查邮箱或稍后再试'
  };
}
