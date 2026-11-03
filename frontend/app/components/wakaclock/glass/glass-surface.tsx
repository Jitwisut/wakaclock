'use client';

import * as React from 'react';

import { MotionConfig } from 'motion/react';

import { cn } from '@/lib/utils';

import './glass.css';

/**
 * Opts a subtree into the glass material theme (see glass.css). The wallpaper gives
 * the translucent window something to blur; motion follows the visitor's
 * reduced-motion preference everywhere inside.
 */
export function GlassSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <div className={cn('glass-surface rounded-[22px]', className)}>
        <div aria-hidden className="glass-wallpaper" />
        {children}
      </div>
    </MotionConfig>
  );
}

export type GlassTint = 'blue' | 'gray' | 'green' | 'indigo' | 'orange' | 'pink';

/** A macOS Settings-style tinted icon tile. */
export function GlassTintIcon({
  icon,
  size = 22,
  tint,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  size?: number;
  tint: GlassTint;
}) {
  return (
    <span
      aria-hidden
      className="glass-tint"
      data-tint={tint}
      style={
        {
          height: size,
          width: size,
          '--tint-radius': `${Math.round(size * 0.3)}px`,
        } as React.CSSProperties
      }
    >
      {React.createElement(icon, { className: 'size-[60%]', strokeWidth: 2.2 })}
    </span>
  );
}

export type GlassTone = 'bad' | 'good' | 'idle' | 'warn';

export function GlassDot({ tone }: { tone: GlassTone }) {
  return <span aria-hidden className="glass-dot" data-tone={tone} />;
}
