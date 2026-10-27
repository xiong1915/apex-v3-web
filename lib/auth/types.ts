// lib/auth/types.ts
// APEX V3 统一身份与会话类型定义

export interface UserMetadata {
  name?: string;
  avatar_url?: string;
  provider?: string;
  [key: string]: any;
}

export interface AppMetadata {
  provider?: string;
  providers?: string[];
  role?: string;
  aal?: 'aal1' | 'aal2';
  [key: string]: any;
}

export interface User {
  id: string;
  email: string;
  email_confirmed_at?: string | null;
  role?: string;
  user_metadata?: UserMetadata;
  app_metadata?: AppMetadata;
  created_at: string;
  updated_at?: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp in seconds
  expires_in: number; // Remaining duration in seconds
  created_at: number; // Unix timestamp in seconds
  user: User;
  aal?: 'aal1' | 'aal2';
}

export interface AuthError {
  retryAfterSeconds?: number;
  message: string;
  status?: number;
  code?: string;
}

export interface AuthResponse<T = any> {
  data: T | null;
  error: AuthError | null;
}
