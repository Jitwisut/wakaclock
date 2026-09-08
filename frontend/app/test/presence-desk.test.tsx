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
