'use client';

import type React from 'react';

import { useDroppable } from '@dnd-kit/core';

import { cn } from '@/lib/utils';

import { useCalendarDnd } from './calendar-dnd-context';

interface DroppableCellProps {
  children?: React.ReactNode;
  className?: string;
  date: Date;
  id: string;
  onClick?: () => void;
  time?: number; // For week/day views, represents hours (e.g., 9.25 for 9:15)
}

export function DroppableCell({
  id,
  date,
  time,
  children,
  className,
  onClick,
}: DroppableCellProps) {
  const { activeEvent } = useCalendarDnd();

  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      date,
      time,
    },
  });

  // Format time for display in tooltip (only for debugging)
  const formattedTime =
    time !== undefined
      ? `${Math.floor(time)}:${Math.round((time - Math.floor(time)) * 60)
          .toString()
          .padStart(2, '0')}`
      : null;

  return (
    <div
      className={cn(
        'data-dragging:bg-accent flex h-full flex-col overflow-hidden px-0.5 py-1 sm:px-1',
        className
      )}
      data-dragging={isOver && activeEvent ? true : undefined}
      onClick={onClick}
      ref={setNodeRef}
      title={formattedTime ? `${formattedTime}` : undefined}
    >
      {children}
    </div>
  );
}
