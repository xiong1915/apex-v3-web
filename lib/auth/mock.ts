// lib/auth/mock.ts
// APEX V3 本地与测试环境 Mock 身份提供者 (无外网凭据时无缝降级并提供全功能回归验证)

import crypto from 'crypto';
import { User, Session, AuthError } from './types';
import { AUTH_CONFIG, isProduction, isValidUuid } from './config';

interface StoredUser {
  user: User;
  passwordHash: string;
  verificationToken?: string;
  resetToken?: string;
  resetTokenExpiry?: number;
  totpSecret?: string;
}

interface StoredSession {
  session: Session;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`apex_salt_${password}`).digest('hex');
}

class MockAuthManager {
  private users: Map<string, StoredUser> = new Map(); // email -> StoredUser
  private sessions: Map<string, StoredSession> = new Map(); // token -> StoredSession
  public sentEmails: Array<{ to: string; type: 'verification' | 'reset'; token: string; link: string; timestamp: number }> = [];

  constructor() {
    this.seedDefaultUsers();
  }

  public reset(): void {
    this.users.clear();
    this.sessions.clear();
    this.sentEmails = [];
    this.seedDefaultUsers();
  }

  private seedDefaultUsers() {
    // 生产环境绝对禁止预置任何 Mock 用户与管理员
    if (isProduction()) {
      return;
    }

    // 仅在配置了有效管理员 UUID 时预置测试管理员 (用于本地测试)
    const adminId = AUTH_CONFIG.adminUserId;
    const adminEmail = AUTH_CONFIG.adminEmail;
    if (adminId && isValidUuid(adminId) && adminEmail) {
      this.users.set(adminEmail.toLowerCase(), {
        user: {
          id: adminId,
          email: adminEmail,
          email_confirmed_at: '2026-01-01T00:00:00.000Z',
          role: 'admin',
          user_metadata: { name: 'APEX Root Admin' },
          app_metadata: { role: 'admin', providers: ['email'], aal: 'aal1' },
          created_at: '2026-01-01T00:00:00.000Z'
        },
        passwordHash: hashPassword('ApexAdmin2026!'),
        totpSecret: 'JBSWY3DPEHPK3PXP'
      });
    }

    // 默认预置普通测试用户 (仅本地非生产环境)
    const testEmail = 'tester@apex-f1.com';
    this.users.set(testEmail.toLowerCase(), {
      user: {
        id: 'user-apex-tester-uuid',
        email: testEmail,
        email_confirmed_at: '2026-01-01T00:00:00.000Z',
        role: 'authenticated',
        user_metadata: { name: 'F1 Enthusiast' },
        app_metadata: { role: 'authenticated', providers: ['email'], aal: 'aal1' },
        created_at: '2026-01-01T00:00:00.000Z'
      },
      passwordHash: hashPassword('Formula1Pass2026!')
    });
  }

  public register(email: string, password: string): { user: User; session: Session | null; error: AuthError | null } {
    if (isProduction()) {
      return { user: null as any, session: null, error: { message: '生产环境彻底禁止 Mock 注册', status: 403 } };
    }
    const normalized = email.toLowerCase().trim();
    if (!normalized || !password) {
      return { user: null as any, session: null, error: { message: '邮箱和密码不能为空', status: 400 } };
    }
    if (password.length < 6) {
      return { user: null as any, session: null, error: { message: '密码长度至少为 6 位字符', status: 400 } };
    }
    if (this.users.has(normalized)) {
      return { user: null as any, session: null, error: { message: '该邮箱已被注册', status: 400 } };
    }

    const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const newUser: User = {
      id: userId,
      email: normalized,
      email_confirmed_at: null, // 未验证
      role: 'authenticated',
      user_metadata: { name: normalized.split('@')[0] },
      app_metadata: { role: 'authenticated', providers: ['email'], aal: 'aal1' },
      created_at: new Date().toISOString()
    };

    this.users.set(normalized, {
      user: newUser,
      passwordHash: hashPassword(password),
      verificationToken
    });

    const verifyLink = `/auth/confirm?token_hash=${verificationToken}&type=email`;
    this.sentEmails.push({
      to: normalized,
      type: 'verification',
      token: verificationToken,
      link: verifyLink,
      timestamp: Date.now()
    });

    return { user: newUser, session: null, error: null };
  }

  public verifyEmail(token: string): { success: boolean; error: AuthError | null } {
    if (isProduction()) {
      return { success: false, error: { message: '生产环境彻底禁止 Mock 邮箱验证', status: 403 } };
    }
    for (const [_, stored] of this.users.entries()) {
      if (stored.verificationToken === token) {
        stored.user.email_confirmed_at = new Date().toISOString();
        delete stored.verificationToken;
        return { success: true, error: null };
      }
    }
    return { success: false, error: { message: '无效或已过期的邮箱验证链接', status: 400 } };
  }

  public login(email: string, password: string): { user: User; session: Session; error: AuthError | null } {
    if (isProduction()) {
      return { user: null as any, session: null as any, error: { message: '生产环境彻底禁止 Mock 登录', status: 403 } };
    }
    const normalized = email.toLowerCase().trim();
    const stored = this.users.get(normalized);
    if (!stored || stored.passwordHash !== hashPassword(password)) {
      return { user: null as any, session: null as any, error: { message: '邮箱或密码错误', status: 401 } };
    }

    // 检查邮箱是否已验证 (管理员默认已验证)
    if (!stored.user.email_confirmed_at && stored.user.role !== 'admin') {
      return { user: null as any, session: null as any, error: { message: '请先完成邮箱验证后再登录', status: 403 } };
    }

    const session = this.createSession(stored.user);
    return { user: stored.user, session, error: null };
  }

  public loginOAuth(provider: 'google' | 'github', oauthUser?: Partial<User>): { user: User; session: Session } {
    if (isProduction()) {
      throw new Error('生产环境彻底禁止 Mock OAuth 登录');
    }
    const email = oauthUser?.email || `oauth_${provider}_user@apex-f1.com`;
    const normalized = email.toLowerCase();
    let stored = this.users.get(normalized);

    if (!stored) {
      const newUser: User = {
        id: `usr_oauth_${crypto.randomBytes(8).toString('hex')}`,
        email: normalized,
        email_confirmed_at: new Date().toISOString(),
        role: 'authenticated',
        user_metadata: {
          name: oauthUser?.user_metadata?.name || `${provider.toUpperCase()} User`,
          avatar_url: oauthUser?.user_metadata?.avatar_url || '',
          provider
        },
        app_metadata: { role: 'authenticated', providers: [provider], aal: 'aal1' },
        created_at: new Date().toISOString()
      };
      stored = {
        user: newUser,
        passwordHash: ''
      };
      this.users.set(normalized, stored);
    }

    const session = this.createSession(stored.user);
    return { user: stored.user, session };
  }

  public createSession(user: User, aal: 'aal1' | 'aal2' = 'aal1'): Session {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = `sb_access_${crypto.randomBytes(32).toString('hex')}`;
    const refreshToken = `sb_refresh_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = nowSec + AUTH_CONFIG.sessionMaxAge; // 30 天持久化

    const session: Session = {
      access_token: token,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      expires_in: AUTH_CONFIG.sessionMaxAge,
      created_at: nowSec,
      user: {
        ...user,
        app_metadata: {
          ...user.app_metadata,
          aal
        }
      },
      aal
    };

    this.sessions.set(token, { session });
    return session;
  }

  public getSession(token: string): Session | null {
    if (!token) return null;
    const stored = this.sessions.get(token);
    if (!stored) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    // 检查 30 天绝对有效期
    if (stored.session.expires_at < nowSec) {
      this.sessions.delete(token);
      return null;
    }

    return stored.session;
  }

  public refreshSession(refreshToken: string): Session | null {
    for (const [token, stored] of this.sessions.entries()) {
      if (stored.session.refresh_token === refreshToken) {
        this.sessions.delete(token);
        const newSession = this.createSession(stored.session.user, stored.session.aal);
        return newSession;
      }
    }
    return null;
  }

  public logout(token: string): void {
    if (token) {
      this.sessions.delete(token);
    }
  }

  public forgotPassword(email: string): { success: boolean; error: AuthError | null } {
    const normalized = email.toLowerCase().trim();
    const stored = this.users.get(normalized);
    if (!stored) {
      // 避免邮箱枚举攻击，统一提示成功
      return { success: true, error: null };
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    stored.resetToken = resetToken;
    stored.resetTokenExpiry = Date.now() + 3600 * 1000; // 1 小时有效

    const link = `/reset-password?token=${resetToken}`;
    this.sentEmails.push({
      to: normalized,
      type: 'reset',
      token: resetToken,
      link,
      timestamp: Date.now()
    });

    return { success: true, error: null };
  }

  public resetPassword(token: string, newPassword: string): { success: boolean; error: AuthError | null } {
    if (!token || !newPassword || newPassword.length < 6) {
      return { success: false, error: { message: '密码长度至少需 6 位', status: 400 } };
    }

    for (const [_, stored] of this.users.entries()) {
      if (stored.resetToken === token && stored.resetTokenExpiry && stored.resetTokenExpiry > Date.now()) {
        stored.passwordHash = hashPassword(newPassword);
        delete stored.resetToken;
        delete stored.resetTokenExpiry;
        return { success: true, error: null };
      }
    }

    return { success: false, error: { message: '重置链接无效或已过期', status: 400 } };
  }

  public verifyAdminTOTP(token: string, totpCode: string): { success: boolean; session?: Session; error: AuthError | null } {
    if (isProduction()) {
      return { success: false, error: { message: '生产环境彻底禁止使用测试 TOTP 验证', status: 403 } };
    }
    const session = this.getSession(token);
    if (!session) {
      return { success: false, error: { message: '未授权或会话已过期', status: 401 } };
    }

    if (!AUTH_CONFIG.adminUserId || !isValidUuid(AUTH_CONFIG.adminUserId) || session.user.id !== AUTH_CONFIG.adminUserId) {
      return { success: false, error: { message: '非管理员账号无权执行该操作', status: 403 } };
    }

    // 仅在非生产环境下接受测试验证码
    if (totpCode === '123456') {
      // 升级会话至 aal2
      this.sessions.delete(token);
      const elevatedSession = this.createSession(session.user, 'aal2');
      return { success: true, session: elevatedSession, error: null };
    }

    return { success: false, error: { message: 'TOTP 动态验证码错误', status: 400 } };
  }

  public getAllUsers(): User[] {
    return Array.from(this.users.values()).map(u => u.user);
  }
}

// 全局 Mock Auth 管理单例
export const mockAuthManager = new MockAuthManager();
