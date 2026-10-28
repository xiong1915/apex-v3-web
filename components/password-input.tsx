'use client';

import React, { useState } from 'react';

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id?: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function PasswordInput({
  id,
  name = 'password',
  value,
  onChange,
  placeholder = '请输入密码',
  required = false,
  autoComplete = 'current-password',
  style,
  className,
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className={className}
        style={{
          width: '100%',
          padding: '12px 42px 12px 14px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--line-dark)',
          borderRadius: '12px',
          color: 'var(--text-primary)',
          fontSize: '14px',
          outline: 'none',
          boxSizing: 'border-box',
          ...style
        }}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? '隐藏密码' : '显示密码'}
        title={visible ? '隐藏密码' : '显示密码'}
        tabIndex={-1}
        style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          padding: '6px',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s ease'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
      >
        {visible ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
