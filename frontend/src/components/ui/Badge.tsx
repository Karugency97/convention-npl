import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import styles from './Badge.module.css';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  color?: string;
  bgColor?: string;
}

export function Badge({
  children,
  className,
  variant = 'default',
  size = 'md',
  color,
  bgColor,
  style,
  ...props
}: BadgeProps) {
  const customStyle = color || bgColor
    ? {
        ...style,
        color: color || undefined,
        backgroundColor: bgColor || undefined,
      }
    : style;

  return (
    <span
      className={cn(
        styles.badge,
        styles[variant],
        styles[size],
        className
      )}
      style={customStyle}
      {...props}
    >
      {children}
    </span>
  );
}
