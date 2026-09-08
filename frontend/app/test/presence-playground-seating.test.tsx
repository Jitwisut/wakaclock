import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PresencePlayground } from '@/components/presence/PresencePlayground';
import { seatAnchor, zoneAt } from '@/lib/presence/floor-geometry';
import type { PresenceUser } from '@/types/presence';

/** The geometry `ensure_zones` in `repository/presence.rs` seeds every room with. */
const ZONES = [
  { center_x: 25, center_y: 30, height: 24, id: 'a', label: 'Pairing Table A', width: 22 },
  { center_x: 75, center_y: 30, height: 24, id: 'b', label: 'Pairing Table B', width: 22 },
  { center_x: 50, center_y: 72, height: 24, id: 'c', label: 'Pairing Table C', width: 22 },
];

const FLOOR = { height: 500, width: 1000 } as DOMRect;

function roster(me: Partial<PresenceUser>): PresenceUser[] {
  return [
    {
      id: 'self',
      isCurrentUser: true,
      status: 'coding',
      username: 'me',
      x: 46,
      y: 46,
      zoneId: null,
      ...me,
    },
    {
      id: 'zoe',
      isCurrentUser: false,
      status: 'idle',
      username: 'zoe',
      x: 10,
      y: 60,
      zoneId: null,
    },
  ];
}

function stubPointerEvents() {
  class Pointer extends MouseEvent {
    pointerId = 1;
  }
  vi.stubGlobal('PointerEvent', Pointer);
}

/** Screen pixels for a playground-percentage point, given the stubbed floor size. */
function pixels(position: { x: number; y: number }) {
  return { clientX: (position.x / 100) * FLOOR.width, clientY: (position.y / 100) * FLOOR.height };
}

function mountFloor(users: PresenceUser[], onMove: (next: { x: number; y: number }) => void) {
  const view = render(
    <PresencePlayground
      currentUserId="self"
      onMoveCurrentUser={onMove}
      reducedMotion
      users={users}
      zones={ZONES}
    />
  );
  const floor = view.container.querySelector('.office-floor') as HTMLDivElement;
  vi.spyOn(floor, 'getBoundingClientRect').mockReturnValue(FLOOR);
  return view;
}

describe('presence playground seating', () => {
  it('snaps a drop inside a pod onto that pod’s desk slot instead of the raw drop point', () => {
    stubPointerEvents();
    const onMove = vi.fn();
    mountFloor(roster({}), onMove);

    const player = screen.getByRole('button', { name: /^You,/ });
    // Release just inside pod C's left edge — the raw point a sprite would overhang from.
    fireEvent.pointerDown(player, { button: 0, ...pixels({ x: 46, y: 46 }) });
    fireEvent.pointerMove(player, pixels({ x: 40, y: 62 }));
    fireEvent.pointerUp(player, pixels({ x: 40, y: 62 }));

    expect(onMove).toHaveBeenCalledWith(seatAnchor(ZONES[2], 0));
    expect(player).toHaveAttribute('data-pose', 'seated');
    vi.unstubAllGlobals();
  });

  it('commits the drop even when a roster snapshot reorders the players mid-drag', () => {
    stubPointerEvents();
    const onMove = vi.fn();
    const { rerender } = mountFloor(roster({}), onMove);

    const player = screen.getByRole('button', { name: /^You,/ });
    fireEvent.pointerDown(player, { button: 0, ...pixels({ x: 46, y: 46 }) });
    fireEvent.pointerMove(player, pixels({ x: 52, y: 70 }));

    // An SSE snapshot arriving mid-drag used to move this node in the DOM, dropping its
    // pointer capture; the pointerup that followed was then silently discarded and the
    // sprite snapped back to its server position.
    rerender(
      <PresencePlayground
        currentUserId="self"
        onMoveCurrentUser={onMove}
        reducedMotion
        users={[...roster({})].reverse()}
        zones={ZONES}
      />
    );
    fireEvent.pointerUp(screen.getByRole('button', { name: /^You,/ }), pixels({ x: 52, y: 70 }));

    expect(onMove).toHaveBeenCalledWith(seatAnchor(ZONES[2], 1));
    vi.unstubAllGlobals();
  });

  it('offers a leave-desk button only while seated, and stands you clear of every pod', () => {
    const onMove = vi.fn();
    const seat = seatAnchor(ZONES[2], 0);
    const { rerender } = mountFloor(roster({ zoneId: 'c', ...seat }), onMove);

    fireEvent.click(screen.getByRole('button', { name: 'Leave desk' }));
    expect(onMove).toHaveBeenCalledTimes(1);
    const standingSpot = onMove.mock.calls[0][0];
    expect(zoneAt(ZONES, standingSpot)).toBeUndefined();

    rerender(
      <PresencePlayground
        currentUserId="self"
        onMoveCurrentUser={onMove}
        reducedMotion
        users={roster({ zoneId: null, ...standingSpot })}
        zones={ZONES}
      />
    );
    expect(screen.queryByRole('button', { name: 'Leave desk' })).toBeNull();
  });

  it('does not snap arrow-key steps, so a seated player can walk out of the pod', () => {
    const onMove = vi.fn();
    const seat = seatAnchor(ZONES[2], 0);
    mountFloor(roster({ zoneId: 'c', ...seat }), onMove);

    fireEvent.keyDown(screen.getByRole('button', { name: /^You,/ }), { key: 'ArrowDown' });
    expect(onMove).toHaveBeenCalledWith({ x: seat.x, y: seat.y + 3 });
  });
});
