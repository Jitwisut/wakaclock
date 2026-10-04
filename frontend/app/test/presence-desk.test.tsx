import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { appearanceFor } from '@/components/presence/appearance';
import { DeskWorkstation } from '@/components/presence/DeskWorkstation';
import { PresencePlayer } from '@/components/presence/PresencePlayer';
import type { PresenceUser } from '@/types/presence';

describe('presence desk pose', () => {
  it('drags onto a desk and back out without waiting for server props', () => {
    class Pointer extends MouseEvent {
      pointerId = 1;
    }
    vi.stubGlobal('PointerEvent', Pointer);
    const containerRef = createRef<HTMLDivElement>();
    const onMove = vi.fn();
    const user: PresenceUser = {
      id: 'self',
      username: 'Me',
      isCurrentUser: true,
      status: 'idle',
      x: 50,
      y: 50,
    };
    const { container } = render(
      <div ref={containerRef}>
        <PresencePlayer
          user={user}
          containerRef={containerRef}
          onMove={onMove}
          reducedMotion={false}
          isDeskPosition={({ x }) => x < 30}
        />
      </div>
    );
    vi.spyOn(containerRef.current!, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      height: 500,
    } as DOMRect);
    const button = screen.getByRole('button');
    button.setPointerCapture = vi.fn();
    button.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(button, { clientX: 500, clientY: 250, button: 0 });
    fireEvent.pointerMove(button, { clientX: 250, clientY: 250 });
    fireEvent.pointerUp(button, { clientX: 250, clientY: 250 });
    expect(button).toHaveAttribute('data-pose', 'seated');
    expect(container.querySelector('.office-anim-keys-l')).not.toBeNull();
    fireEvent.pointerDown(button, { clientX: 250, clientY: 250, button: 0 });
    expect(button).toHaveAttribute('data-pose', 'standing');
    fireEvent.pointerMove(button, { clientX: 600, clientY: 250 });
    fireEvent.pointerUp(button, { clientX: 600, clientY: 250 });
    expect(button).toHaveAttribute('data-pose', 'standing');
    expect(onMove).toHaveBeenLastCalledWith({ x: 60, y: 50 });
    vi.unstubAllGlobals();
  });
  it('uses the desk position even before zone membership catches up', () => {
    const user = {
      id: 'self',
      username: 'Me',
      isCurrentUser: true,
      status: 'idle',
      x: 50,
      y: 50,
      zoneId: null,
    } as PresenceUser;
    const props = { user, containerRef: createRef<HTMLDivElement>(), reducedMotion: false };
    const { rerender, container } = render(<PresencePlayer {...props} atDesk />);
    expect(screen.getByRole('button')).toHaveAttribute('data-pose', 'seated');
    expect(container.querySelector('.office-anim-keys-l')).not.toBeNull();
    rerender(<PresencePlayer {...props} atDesk={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('data-pose', 'standing');
    expect(container.querySelector('.office-anim-keys-l')).toBeNull();
    expect(container.querySelector('.presence-player-idle')).toBeNull();
  });

  it('keeps the seated pose without animation when reduced motion is enabled', () => {
    const { container } = render(
      <DeskWorkstation
        appearance={appearanceFor('self')}
        entering
        reducedMotion
        status="idle"
        working
      />
    );
    expect(container.querySelector('.presence-character')).not.toBeNull();
    expect(container.querySelector('.office-anim-sitdown')).toBeNull();
    expect(container.querySelector('.office-anim-keys-l')).toBeNull();
    expect(container.querySelector('.office-crt-line')).toBeNull();
  });
});

it.each(['idle', 'offline', 'coding'] as const)(
  'renders %s workstation activity without inventing typing',
  (status) => {
    const { container } = render(
      <DeskWorkstation appearance={appearanceFor('desk')} reducedMotion={false} status={status} />
    );
    expect(Boolean(container.querySelector('.office-anim-typing'))).toBe(status === 'coding');
    expect(Boolean(container.querySelector('.office-anim-breathe'))).toBe(status === 'idle');
    expect(Boolean(container.querySelector('.office-crt-line'))).toBe(status === 'coding');
  }
);

it('ignores secondary pointers and preserves the last preview when the floor collapses during a drag', () => {
  class Pointer extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  vi.stubGlobal('PointerEvent', Pointer);
  try {
    const containerRef = createRef<HTMLDivElement>();
    const onMove = vi.fn();
    const user: PresenceUser = {
      id: 'self',
      username: 'Me',
      isCurrentUser: true,
      status: 'idle',
      x: 50,
      y: 50,
    };
    const view = render(
      <div ref={containerRef}>
        <PresencePlayer user={user} containerRef={containerRef} onMove={onMove} reducedMotion />
      </div>
    );
    const rect = vi
      .spyOn(containerRef.current!, 'getBoundingClientRect')
      .mockReturnValue({ width: 1000, height: 500 } as DOMRect);
    const button = screen.getByRole('button');
    fireEvent.pointerDown(button, { button: 2, pointerId: 1 });
    expect(button).toHaveStyle({ cursor: 'grab' });
    fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientX: 500, clientY: 250 });
    fireEvent.pointerDown(button, { button: 0, pointerId: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(window, { pointerId: 2 });
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 600, clientY: 300 });
    expect(button).toHaveStyle({ left: '60%', top: '60%' });
    rect.mockReturnValue({ width: 0, height: 0 } as DOMRect);
    fireEvent.pointerCancel(window, { pointerId: 1 });
    expect(onMove).toHaveBeenCalledExactlyOnceWith({ x: 60, y: 60 });
    view.unmount();
    fireEvent.pointerUp(window, { pointerId: 1 });
    expect(onMove).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});

it('recovers invalid server coordinates and ignores keyboard movement without a handler', () => {
  const user: PresenceUser = {
    id: 'self',
    username: 'Me',
    isCurrentUser: true,
    status: 'offline',
    x: NaN,
    y: Infinity,
  };
  render(<PresencePlayer user={user} containerRef={createRef<HTMLDivElement>()} reducedMotion />);
  const button = screen.getByRole('button');
  expect(button).toHaveStyle({ left: '46%', top: '46%' });
  fireEvent.keyDown(button, { key: 'ArrowRight' });
  expect(button).toHaveStyle({ left: '46%', top: '46%' });
});

it('recovers to finite floor coordinates when pointer delta overflows', () => {
  class Pointer extends MouseEvent {
    pointerId = 1;
  }
  vi.stubGlobal('PointerEvent', Pointer);
  try {
    const containerRef = createRef<HTMLDivElement>();
    const onMove = vi.fn();
    const user: PresenceUser = {
      id: 'self',
      username: 'Me',
      isCurrentUser: true,
      status: 'idle',
      x: 20,
      y: 20,
    };
    render(
      <div ref={containerRef}>
        <PresencePlayer user={user} containerRef={containerRef} onMove={onMove} reducedMotion />
      </div>
    );
    vi.spyOn(containerRef.current!, 'getBoundingClientRect').mockReturnValue({
      width: Number.MIN_VALUE,
      height: 500,
    } as DOMRect);
    const button = screen.getByRole('button');
    fireEvent.pointerDown(button, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(window, { clientX: 100, clientY: 0 });
    expect(onMove).toHaveBeenCalledExactlyOnceWith({ x: 50, y: 20 });
    expect(button).toHaveStyle({ left: '50%', top: '20%' });
  } finally {
    vi.unstubAllGlobals();
  }
});
