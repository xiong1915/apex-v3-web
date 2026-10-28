'use client';

import { useEffect, useRef, useState, type DetailsHTMLAttributes, type ReactNode } from 'react';

export interface PersistentDetailsProps extends DetailsHTMLAttributes<HTMLDetailsElement> {
  id: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function PersistentDetails({
  id,
  defaultOpen = false,
  children,
  className,
  onToggle,
  ...props
}: PersistentDetailsProps) {
  const [open, setOpen] = useState(defaultOpen);
  const initialized = useRef(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`apex:details:${id}`);
      if (stored !== null) {
        setOpen(stored === '1');
      }
    } catch {}
    initialized.current = true;
  }, [id]);

  const handleToggle: DetailsHTMLAttributes<HTMLDetailsElement>['onToggle'] = (e) => {
    const isNowOpen = e.currentTarget.open;
    setOpen(isNowOpen);
    try {
      sessionStorage.setItem(`apex:details:${id}`, isNowOpen ? '1' : '0');
    } catch {}
    onToggle?.(e);
  };

  return (
    <details
      {...props}
      id={id}
      open={open}
      className={className}
      onToggle={handleToggle}
    >
      {children}
    </details>
  );
}
