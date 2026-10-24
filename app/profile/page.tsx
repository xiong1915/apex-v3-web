// app/profile/page.tsx
// APEX V3 — APEX ID 个人中心
// 高端赛车视觉质感，多端响应式适配，数据持久化与实时同步

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchCurrentSession } from '@/lib/auth/client';
import {
  fetchUserProfile,
  updateUserProfileApi,
  uploadAvatarApi,
  deleteAvatarApi,
  UserProfile
} from '@/lib/profile/client';
import { F1_TEAMS_2026, F1TeamMetadata } from '@/lib/f1/teams-metadata';
import { validateDisplayName } from '@/lib/profile/validation';

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 认证与基本状态
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // 昵称编辑状态
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameSavedNotice, setNicknameSavedNotice] = useState(false);

  // 车队收藏状态
  const [favoriteTeamIds, setFavoriteTeamIds] = useState<string[]>([]);
  const [savingTeams, setSavingTeams] = useState(false);
  const [teamsSavedNotice, setTeamsSavedNotice] = useState(false);

  // 头像裁剪与上传模态框状态
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropScale, setCropScale] = useState(1);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // 1. 初始化鉴权与读取 Profile
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { user: currentSessionUser, error: authError } = await fetchCurrentSession();
        if (!mounted) return;

        if (authError || !currentSessionUser) {
          router.replace('/login?returnUrl=/profile');
          return;
        }

        setUser(currentSessionUser);

        const { profile: userProfile } = await fetchUserProfile();
        if (!mounted) return;

        if (userProfile) {
          setProfile(userProfile);
          setNicknameInput(userProfile.display_name || '');
          setFavoriteTeamIds(userProfile.favorite_team_ids || []);
        } else {
          // 降级以 sessionUser 兜底
          const fallbackName = currentSessionUser.user_metadata?.name || currentSessionUser.email?.split('@')[0] || 'APEX 车迷';
          setNicknameInput(fallbackName);
        }
      } catch (e) {
        console.error('Failed to load profile session:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [router]);

  // 2. 实时校验昵称输入
  const handleNicknameChange = (val: string) => {
    setNicknameInput(val);
    setNicknameSavedNotice(false);
    if (val.trim().length === 0) {
      setNicknameError('昵称不能为空');
      return;
    }
    const check = validateDisplayName(val);
    if (!check.valid) {
      setNicknameError(check.error || '昵称不合法');
    } else {
      setNicknameError(null);
    }
  };

  // 3. 保存昵称
  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateDisplayName(nicknameInput);
    if (!check.valid || !check.value) {
      setNicknameError(check.error || '请输入合法的昵称');
      return;
    }

    setSavingNickname(true);
    setNicknameError(null);
    try {
      const { profile: updated, error } = await updateUserProfileApi({
        display_name: check.value
      });
      if (error) {
        setNicknameError(error);
      } else if (updated) {
        setProfile(updated);
        setNicknameInput(updated.display_name);
        setNicknameSavedNotice(true);
        setTimeout(() => setNicknameSavedNotice(false), 3000);
      }
    } catch {
      setNicknameError('保存失败，请稍后重试');
    } finally {
      setSavingNickname(false);
    }
  };

  // 4. 选择图片并启动实时圆形裁剪模态框
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('所选图片体积过大，请选择 10MB 以内的图片');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCropImageSrc(event.target?.result as string);
      setCropScale(1);
      setCropModalOpen(true);
      setAvatarError(null);
    };
    reader.readAsDataURL(file);

    // 重置 input 以便能重复选择同一张图片
    e.target.value = '';
  };

  // 5. 绘制 Canvas 圆形裁剪实时预览
  useEffect(() => {
    if (!cropModalOpen || !cropImageSrc || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = cropImageSrc;
    img.onload = () => {
      const size = 300;
      canvas.width = size;
      canvas.height = size;

      ctx.clearRect(0, 0, size, size);

      // 背景与暗度遮罩
      ctx.fillStyle = '#0B0D12';
      ctx.fillRect(0, 0, size, size);

      // 计算居中缩放
      const minDim = Math.min(img.width, img.height);
      const drawWidth = (img.width / minDim) * size * cropScale;
      const drawHeight = (img.height / minDim) * size * cropScale;
      const dx = (size - drawWidth) / 2;
      const dy = (size - drawHeight) / 2;

      ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

      // 绘制圆形裁剪参考线遮罩
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.rect(0, 0, size, size);
      ctx.arc(size / 2, size / 2, size / 2 - 10, 0, Math.PI * 2, true);
      ctx.fill();

      // 辅助红/金圆环线
      ctx.strokeStyle = '#E10600';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };
  }, [cropModalOpen, cropImageSrc, cropScale]);

  // 6. 执行裁切并上传至 Supabase Storage
  const handleConfirmCropAndUpload = async () => {
    if (!cropImageSrc) return;
    setUploadingAvatar(true);
    setAvatarError(null);

    try {
      // 在离屏 canvas 中渲染纯净的圆形图像
      const offscreen = document.createElement('canvas');
      const targetSize = 400; // 输出 400x400 高清圆形
      offscreen.width = targetSize;
      offscreen.height = targetSize;
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) throw new Error('Canvas context unavailable');

      const img = new Image();
      img.src = cropImageSrc;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });

      // 裁剪为圆形
      offCtx.beginPath();
      offCtx.arc(targetSize / 2, targetSize / 2, targetSize / 2, 0, Math.PI * 2);
      offCtx.closePath();
      offCtx.clip();

      const minDim = Math.min(img.width, img.height);
      const drawWidth = (img.width / minDim) * targetSize * cropScale;
      const drawHeight = (img.height / minDim) * targetSize * cropScale;
      const dx = (targetSize - drawWidth) / 2;
      const dy = (targetSize - drawHeight) / 2;
      offCtx.drawImage(img, dx, dy, drawWidth, drawHeight);

      // 导出为 WebP/JPEG Blob 并压缩 (质量 0.88, 严格在 2MB 内)
      const blob = await new Promise<Blob | null>((resolve) => {
        offscreen.toBlob((b) => resolve(b), 'image/jpeg', 0.88);
      });

      if (!blob) throw new Error('生成头像失败');

      const { profile: updated, error } = await uploadAvatarApi(blob);
      if (error) {
        setAvatarError(error);
      } else if (updated) {
        setProfile(updated);
        setCropModalOpen(false);
      }
    } catch (e: any) {
      setAvatarError(e.message || '上传头像异常，请重试');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // 7. 恢复默认头像
  const handleResetAvatar = async () => {
    if (!confirm('确定恢复为初始默认头像吗？')) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const { profile: updated, error } = await deleteAvatarApi();
      if (error) {
        setAvatarError(error);
      } else if (updated) {
        setProfile(updated);
      }
    } catch {
      setAvatarError('恢复默认头像失败，请重试');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // 8. 切换车队收藏
  const toggleFavoriteTeam = (teamId: string) => {
    setTeamsSavedNotice(false);
    setFavoriteTeamIds((prev) => {
      const exists = prev.includes(teamId);
      const next = exists ? prev.filter((id) => id !== teamId) : [...prev, teamId];
      return next;
    });
  };

  // 9. 保存车队收藏
  const handleSaveTeams = async () => {
    setSavingTeams(true);
    try {
      const { profile: updated, error } = await updateUserProfileApi({
        favorite_team_ids: favoriteTeamIds
      });
      if (error) {
        alert(error);
      } else if (updated) {
        setProfile(updated);
        setFavoriteTeamIds(updated.favorite_team_ids || []);
        setTeamsSavedNotice(true);
        setTimeout(() => setTeamsSavedNotice(false), 3000);
      }
    } catch {
      alert('保存车队偏好失败，请稍后重试');
    } finally {
      setSavingTeams(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: '#8E929C' }}>
          <div className="mono" style={{ fontSize: '13px', letterSpacing: '0.1em' }}>APEX ID 载入中…</div>
        </div>
      </div>
    );
  }

  const currentDisplayName = profile?.display_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'APEX 车迷';
  const currentAvatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || null;
  const initialLetter = currentDisplayName.trim().charAt(0).toUpperCase();

  // 登录方式与注册时间显示
  const provider = profile?.provider || user?.app_metadata?.provider || 'email';
  const createdAtFormatted = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '2026 赛季';

  // 已收藏车队元数据列表
  const favoriteTeamsList = favoriteTeamIds
    .map((id) => F1_TEAMS_2026.find((t) => t.id === id))
    .filter(Boolean) as F1TeamMetadata[];

  return (
    <div className="profile-page-shell">
      <div className="profile-container">
        {/* 顶部标题区 */}
        <header className="profile-hero">
          <div className="profile-hero-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            APEX ID · 极速身份凭证
          </div>
          <h1 className="profile-hero-title">个人控制中心</h1>
          <p className="profile-hero-subtitle">定制专属赛车头像、昵称身份与心仪制造商阵容。</p>
        </header>

        {/* 核心网格布局 */}
        <div className="profile-grid">
          {/* 左侧：身份卡片与个人设定 */}
          <aside className="apex-card identity-card">
            <div className="apex-card-header">
              <h2 className="apex-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                APEX ID 身份卡
              </h2>
              <span className="mono" style={{ fontSize: '11px', color: '#6C707C' }}>ID #{user?.id?.slice(0, 8)}</span>
            </div>

            {/* 头像区域 */}
            <div className="avatar-edit-section">
              <div
                className="avatar-circle-wrap"
                role="button"
                tabIndex={0}
                aria-label="点击更换头像"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              >
                {currentAvatarUrl ? (
                  <img
                    src={currentAvatarUrl}
                    alt={currentDisplayName}
                    className="avatar-circle-img"
                  />
                ) : (
                  <div className="avatar-circle-fallback">
                    {initialLetter}
                  </div>
                )}
                <div className="avatar-overlay-btn" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span>更换</span>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />

              <div className="avatar-action-buttons">
                <button
                  type="button"
                  className="avatar-mini-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  上传头像
                </button>
                {profile?.avatar_path && (
                  <button
                    type="button"
                    className="avatar-mini-btn danger"
                    onClick={handleResetAvatar}
                    disabled={uploadingAvatar}
                  >
                    恢复默认
                  </button>
                )}
              </div>

              {avatarError && <div className="form-feedback error">{avatarError}</div>}
            </div>

            {/* 昵称修改表单 */}
            <form onSubmit={handleSaveNickname} className="form-group">
              <label htmlFor="nickname-input" className="form-label">
                <span>用户昵称</span>
                <span className={`form-counter ${Array.from(nicknameInput.trim()).length > 20 ? 'limit' : ''}`}>
                  {Array.from(nicknameInput.trim()).length} / 24 字符
                </span>
              </label>
              <input
                id="nickname-input"
                type="text"
                className="form-input"
                value={nicknameInput}
                onChange={(e) => handleNicknameChange(e.target.value)}
                maxLength={24}
                placeholder="2-24 位字符"
                autoComplete="off"
              />
              {nicknameError && <div className="form-feedback error">{nicknameError}</div>}
              {nicknameSavedNotice && <div className="form-feedback success">✓ 昵称已更新并同步全站</div>}

              <button
                type="submit"
                className="apex-btn-primary"
                style={{ marginTop: '8px' }}
                disabled={savingNickname || Boolean(nicknameError)}
              >
                {savingNickname ? '正在保存…' : '保存昵称'}
              </button>
            </form>

            {/* 账号元信息只读展示 */}
            <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '16px' }}>
              <div className="meta-row">
                <span className="meta-key">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  绑定邮箱 (只读)
                </span>
                <span className="meta-val mono" style={{ fontSize: '12px' }}>{user?.email}</span>
              </div>

              <div className="meta-row">
                <span className="meta-key">登录方式</span>
                <span className="meta-val">
                  {provider === 'google' ? (
                    <span className="provider-badge">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                      </svg>
                      Google
                    </span>
                  ) : provider === 'github' ? (
                    <span className="provider-badge">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                      </svg>
                      GitHub
                    </span>
                  ) : (
                    <span className="provider-badge">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      邮箱密码
                    </span>
                  )}
                </span>
              </div>

              <div className="meta-row">
                <span className="meta-key">加入时间</span>
                <span className="meta-val mono" style={{ fontSize: '12px' }}>{createdAtFormatted}</span>
              </div>
            </div>
          </aside>

          {/* 右侧：喜欢的 F1 车队选择器 */}
          <main className="teams-section">
            {/* 已收藏车队展示区 */}
            <div className="apex-card">
              <div className="apex-card-header">
                <h2 className="apex-card-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  已收藏的车队 ({favoriteTeamsList.length})
                </h2>
                <span className="data-note" style={{ fontSize: '12px' }}>点击进入车队专属档案</span>
              </div>

              {favoriteTeamsList.length > 0 ? (
                <div className="favorite-showcase">
                  {favoriteTeamsList.map((team) => (
                    <div
                      key={team.id}
                      className="favorite-pill"
                      style={{ '--team-color': team.primaryColor } as React.CSSProperties}
                    >
                      <Link href={`/teams/${team.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <span className="favorite-pill-code">{team.code}</span>
                        <strong>{team.name}</strong>
                        <span aria-hidden="true" style={{ fontSize: '11px', opacity: 0.6 }}>↗</span>
                      </Link>
                      <button
                        type="button"
                        className="favorite-remove-btn"
                        aria-label={`取消收藏 ${team.name}`}
                        onClick={() => toggleFavoriteTeam(team.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="favorite-empty-hint">
                  尚未收藏任何车队。在下方制造商阵容中勾选你支持的车队。
                </div>
              )}
            </div>

            {/* 2026 赛季车队选择器网格 */}
            <div className="apex-card">
              <div className="apex-card-header">
                <h2 className="apex-card-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  2026 赛季制造商阵容
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {teamsSavedNotice && <span className="form-feedback success">✓ 车队偏好已持久化</span>}
                  <button
                    type="button"
                    className="avatar-mini-btn"
                    style={{ background: '#E10600', color: '#FFF', borderColor: '#E10600' }}
                    onClick={handleSaveTeams}
                    disabled={savingTeams}
                  >
                    {savingTeams ? '保存中…' : '保存偏好'}
                  </button>
                </div>
              </div>

              <div className="constructors-grid">
                {F1_TEAMS_2026.map((team) => {
                  const isSelected = favoriteTeamIds.includes(team.id);
                  return (
                    <div
                      key={team.id}
                      className={`team-card ${isSelected ? 'selected' : ''}`}
                      style={{ '--team-color': team.primaryColor } as React.CSSProperties}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={() => toggleFavoriteTeam(team.id)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          toggleFavoriteTeam(team.id);
                        }
                      }}
                    >
                      <div className="team-card-top">
                        <span className="team-card-code">{team.code}</span>
                        <div className="team-card-check" aria-hidden="true">
                          {isSelected ? '✓' : ''}
                        </div>
                      </div>

                      <div className="team-card-body">
                        <h3>{team.name}</h3>
                        <p>{team.nameEn}</p>
                      </div>

                      <div className="team-card-foot">
                        <span>动力: {team.engine}</span>
                        <span>{team.base.split('(')[0]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* 头像圆形裁剪 Modal */}
      {cropModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-crop-title">
          <div className="modal-content">
            <div className="modal-header">
              <h3 id="modal-crop-title">调整头像位置与缩放</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setCropModalOpen(false)}
                aria-label="关闭裁剪窗口"
              >
                ×
              </button>
            </div>

            <div className="crop-canvas-container">
              <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
            </div>

            <div className="crop-controls">
              <div className="crop-slider-row">
                <span>缩放</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={cropScale}
                  onChange={(e) => setCropScale(parseFloat(e.target.value))}
                  className="crop-slider"
                  aria-label="头像缩放滑块"
                />
                <span className="mono">{cropScale.toFixed(2)}x</span>
              </div>
              <span className="data-note" style={{ fontSize: '11px', textAlign: 'center' }}>
                支持 JPG、PNG、WebP，裁剪后自动优化压缩至 2MB 安全尺寸以内。
              </span>
            </div>

            {avatarError && <div className="form-feedback error">{avatarError}</div>}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCropModalOpen(false)}
                disabled={uploadingAvatar}
              >
                取消
              </button>
              <button
                type="button"
                className="apex-btn-primary"
                onClick={handleConfirmCropAndUpload}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? '正在上传…' : '应用新头像'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
