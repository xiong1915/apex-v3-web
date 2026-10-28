// components/glass/GlassSurface.tsx
// 统一 Liquid Glass 表面容器组件，内建多端自适应物理降级 (Mobile Physical Degradation)

import React from 'react';
import { LiquidGlass } from '@/components/ui/liquid-glass';

export interface GlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'subtle' | 'elevated' | 'floating';
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const GlassSurface = React.forwardRef<HTMLDivElement, GlassSurfaceProps>(
  ({ variant = 'subtle', children, className = '', style = {}, ...props }, ref) => {
    return (
      <LiquidGlass
        ref={ref}
        className={`glass-surface glass-${variant} ${className}`}
        style={style}
        {...props}
      >
        {children}
      </LiquidGlass>
    );
  }
);

GlassSurface.displayName = 'GlassSurface';
