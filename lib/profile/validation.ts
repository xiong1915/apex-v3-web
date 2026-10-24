// lib/profile/validation.ts
// APEX V3 APEX ID 个人中心输入校验与头像安全防御层

import { isValidTeamId, canonicalTeamId } from '@/lib/f1/teams-metadata';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB 严格上限
export const MIN_DISPLAY_NAME_CHARS = 2;
export const MAX_DISPLAY_NAME_CHARS = 24;

// 包含非法控制字符的正则 (ASCII 0-31 以及 127)
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F-\u009F]/;

// 危险 HTML / 脚本标签与属性检测
const DANGEROUS_HTML_REGEX = /<[a-z\/\!][\s\S]*>|javascript:|data:\s*text\/html|vbscript:|on\w+\s*=/i;

/**
 * 校验并清理用户昵称
 */
export function validateDisplayName(raw: unknown): { valid: boolean; value?: string; error?: string } {
  if (typeof raw !== 'string') {
    return { valid: false, error: '昵称必须为文本格式' };
  }

  // 1. 去除首尾空格
  const trimmed = raw.trim();

  // 2. 检查控制字符
  if (CONTROL_CHARS_REGEX.test(trimmed)) {
    return { valid: false, error: '昵称包含非法控制字符，请重新输入' };
  }

  // 3. 拒绝 HTML / 脚本注入
  if (DANGEROUS_HTML_REGEX.test(trimmed) || trimmed.includes('<') || trimmed.includes('>')) {
    return { valid: false, error: '昵称不能包含 HTML 标签或特殊脚本字符' };
  }

  // 4. Unicode 字符长度安全计算 (兼顾中英文、Emoji)
  const charLength = Array.from(trimmed).length;
  if (charLength < MIN_DISPLAY_NAME_CHARS) {
    return { valid: false, error: `昵称长度至少需要 ${MIN_DISPLAY_NAME_CHARS} 个字符` };
  }

  if (charLength > MAX_DISPLAY_NAME_CHARS) {
    return { valid: false, error: `昵称长度不能超过 ${MAX_DISPLAY_NAME_CHARS} 个字符` };
  }

  return { valid: true, value: trimmed };
}

/**
 * 校验并归一化车队收藏列表
 */
export function validateFavoriteTeamIds(raw: unknown): { valid: boolean; value: string[]; error?: string } {
  if (!Array.isArray(raw)) {
    return { valid: false, value: [], error: '车队收藏必须是数组格式' };
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const cleanId = item.trim().toLowerCase();
    if (!cleanId) continue;

    if (!isValidTeamId(cleanId)) {
      return { valid: false, value: [], error: `未知的 F1 车队标识: ${cleanId}` };
    }

    const canonical = canonicalTeamId(cleanId);
    if (!seen.has(canonical)) {
      seen.add(canonical);
      result.push(canonical);
    }
  }

  return { valid: true, value: result };
}

export type AvatarFormat = 'jpg' | 'png' | 'webp';

export interface AvatarValidationResult {
  valid: boolean;
  ext?: AvatarFormat;
  mimeType?: string;
  error?: string;
}

/**
 * 严格校验头像二进制文件的魔数 (Magic Bytes)、尺寸与安全性
 */
export function validateAvatarBuffer(buffer: Buffer): AvatarValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: '上传的头像文件为空' };
  }

  if (buffer.length > MAX_AVATAR_BYTES) {
    return { valid: false, error: `头像体积超过限制 (最大允许 2MB，当前 ${(buffer.length / 1024 / 1024).toFixed(2)}MB)` };
  }

  // 1. JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, ext: 'jpg', mimeType: 'image/jpeg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { valid: true, ext: 'png', mimeType: 'image/png' };
  }

  // 3. WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { valid: true, ext: 'webp', mimeType: 'image/webp' };
  }

  // 文本内容防御性检测 (拒绝伪装的 SVG, HTML, PHP, XML, JS 等)
  const headerPreview = buffer.slice(0, Math.min(buffer.length, 512)).toString('utf8').toLowerCase();
  if (
    headerPreview.includes('<svg') ||
    headerPreview.includes('<?xml') ||
    headerPreview.includes('<html') ||
    headerPreview.includes('<!doctype') ||
    headerPreview.includes('<?php') ||
    headerPreview.includes('<script')
  ) {
    return { valid: false, error: '不支持 SVG、HTML 或可执行脚本等矢量/代码格式，仅支持 JPG、PNG、WebP' };
  }

  return { valid: false, error: '不支持的文件类型，仅支持 JPG、PNG、WebP 图片' };
}
