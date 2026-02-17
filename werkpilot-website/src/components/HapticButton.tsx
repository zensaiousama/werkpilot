'use client';

import { useCallback, type ReactNode, type CSSProperties } from 'react';

interface HapticButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  type?: 'button' | 'submit';
  disabled?: boolean;
  'data-track'?: string;
  'aria-label'?: string;
}

export default function HapticButton({
  children,
  onClick,
  className,
  style,
  type = 'button',
  disabled,
  ...rest
}: HapticButtonProps) {
  const handleClick = useCallback(() => {
    // Trigger haptic feedback if available
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    onClick?.();
  }, [onClick]);

  return (
    <button
      type={type}
      onClick={handleClick}
      className={className}
      style={style}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
