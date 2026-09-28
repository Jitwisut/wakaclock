import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ActiveRoomView,
  ActivityFeed,
  AvailabilityMessage,
  CoworkingHistoryPanel,
  LobbyView,
  PresenceGuide,
  RoomPulse,
} from '@/components/presence/PresenceRoomViews';
import type { PresenceV2Room, PresenceV2RoomData, PresenceV2Snapshot } from '@/lib/wakaclock/types';
import type { PresenceUser } from '@/types/presence';

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/use-reduced-motion', () => ({ useReducedMotion: () => reduced.value }));

vi.mock('@/components/presence/PresencePlayground', () => ({
  PresencePlayground: () => <div data-testid="floor" />,
}));

afterEach(() => {
  vi.useRealTimers();
  reduced.value = false;
});

const zone = {
  center_x: 20,
  center_y: 30,
  height: 20,
  id: 'z1',
  label: 'Table A',
  room_id: 'r1',
  sort_order: 0,
  width: 20,
};

const roomData: PresenceV2RoomData = {
  ended_at: null,
  expires_at: '2026-10-01T10:00:00Z',
  id: 'r1',
  kind: 'adhoc',
  name: 'Pairing',
  owner_user_id: 'me',
  team_id: null,
  zones: [zone, { ...zone, id: 'z2', label: 'Table B' }],
};

describe('RoomPulse', () => {
  it('shows counts, co-working and the state split', () => {
    render(
      <RoomPulse
        counts={{ coding: 2, idle: 1, offline: 0 }}
        pods={3}
        podsOccupied={1}
        sessions={1}
      />
    );

    expect(
      screen.getByRole('heading', { name: '2 of 3 people here are coding right now.' })
    ).toBeInTheDocument();
    expect(screen.getByText(/co-working session ·/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '2 coding, 1 idle, 0 inactive' })).toBeInTheDocument();
  });

  it('animates counters to their new value', async () => {
    const { container, rerender } = render(
      <RoomPulse
        counts={{ coding: 1, idle: 0, offline: 0 }}
        pods={3}
        podsOccupied={0}
        sessions={0}
      />
    );
    rerender(
      <RoomPulse
        counts={{ coding: 3, idle: 0, offline: 0 }}
        pods={3}
        podsOccupied={0}
        sessions={0}
      />
    );

    await waitFor(() =>
      expect(
        [...container.querySelectorAll('[aria-hidden="true"]')].map((el) => el.textContent)
      ).toContain('3')
    );
  });

  it('jumps straight to new counts under reduced motion', () => {
    reduced.value = true;
    const { container, rerender } = render(
      <RoomPulse
        counts={{ coding: 1, idle: 0, offline: 0 }}
        pods={3}
        podsOccupied={0}
        sessions={0}
      />
    );
    rerender(
      <RoomPulse
        counts={{ coding: 4, idle: 0, offline: 0 }}
        pods={3}
        podsOccupied={0}
        sessions={0}
      />
    );

    expect(
      [...container.querySelectorAll('[aria-hidden="true"]')].map((el) => el.textContent)
    ).toContain('4');
  });

  it('drops the split bar for an empty room and pluralises sessions', () => {
    render(
      <RoomPulse
        counts={{ coding: 0, idle: 0, offline: 0 }}
        pods={3}
        podsOccupied={0}
        sessions={2}
      />
    );

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(/co-working sessions ·/)).toBeInTheDocument();
  });
});

describe('ActivityFeed', () => {
  it('explains itself when empty and lists events otherwise', () => {
    const { rerender } = render(<ActivityFeed events={[]} />);
    expect(screen.getByText(/will appear here as they happen/)).toBeInTheDocument();

    rerender(
      <ActivityFeed
        events={[
          { at: 1000, id: '1', kind: 'joined', text: 'bob joined the room' },
          { at: 1000, id: '2', kind: 'left', text: 'amy left the room' },
          { at: 1000, id: '3', kind: 'session_started', text: 'Co-working started' },
          { at: 1000, id: '4', kind: 'session_ended', text: 'Co-working ended' },
        ]}
      />
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('bob joined the room')).toBeInTheDocument();
  });
});

describe('CoworkingHistoryPanel', () => {
  function history(overrides = {}) {
    return {
      error: null,
      items: [],
      loading: false,
      previousSummary: null,
      reload: vi.fn(async () => undefined),
      weeklySummary: null,
      ...overrides,
    };
  }

  it('compares this week with the last', () => {
    const reload = vi.fn(async () => undefined);
    render(
      <CoworkingHistoryPanel
        history={history({
          previousSummary: { activeDays: 2, durationSeconds: 3600, sessions: 0 },
          reload,
          weeklySummary: { activeDays: 1, durationSeconds: 3600, sessions: 3 },
        })}
      />
    );

    expect(screen.getByText('New this week')).toBeInTheDocument();
    expect(screen.getByText('Same as last week')).toBeInTheDocument();
    expect(screen.getByText(/-50% vs last week/)).toBeInTheDocument();
    expect(screen.getByText('1h 0m')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh co-working history' }));
    expect(reload).toHaveBeenCalled();
  });

  it('shows growth, no delta without a baseline, loading and errors with retry', () => {
    const reload = vi.fn(async () => undefined);
    const { rerender } = render(
      <CoworkingHistoryPanel
        history={history({
          previousSummary: { activeDays: 1, durationSeconds: 0, sessions: 0 },
          weeklySummary: { activeDays: 3, durationSeconds: 0, sessions: 0 },
        })}
      />
    );
    expect(screen.getByText(/\+200% vs last week/)).toBeInTheDocument();

    rerender(
      <CoworkingHistoryPanel
        history={history({ weeklySummary: { activeDays: 0, durationSeconds: 0, sessions: 0 } })}
      />
    );
    expect(screen.queryByText(/vs last week/)).toBeNull();

    rerender(
      <CoworkingHistoryPanel
        history={history({ error: 'History is unavailable', loading: true, reload })}
      />
    );
    expect(screen.getByRole('button', { name: 'Refresh co-working history' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('History is unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reload).toHaveBeenCalled();
  });
});

function snapshot(overrides: Partial<PresenceV2Snapshot> = {}): PresenceV2Snapshot {
  return {
    room: roomData,
    roster: [
      { position: { x: 20, y: 30 }, state: 'coding', user_id: 'me', username: 'me', zone_id: 'z1' },
      { position: null, state: 'idle', user_id: 'b', username: 'bob', zone_id: null },
    ],
    server_time: 2000,
    sessions: [],
    version: 1,
    zones: roomData.zones,
    ...overrides,
  };
}

const users: PresenceUser[] = [
  { id: 'me', isCurrentUser: true, status: 'coding', username: 'me', x: 20, y: 30, zoneId: 'z1' },
  { id: 'b', isCurrentUser: false, status: 'idle', username: 'bob', x: 50, y: 50, zoneId: null },
];

function renderRoom(overrides: Partial<React.ComponentProps<typeof ActiveRoomView>> = {}) {
  const props = {
    activeRoom: roomData,
    currentUserId: 'me',
    inviteId: 'inv',
    inviteUrl: 'https://example.test/#invite=abc',
    onCopyInvite: vi.fn(async () => undefined),
    onEnd: vi.fn(async () => undefined),
    onLeave: vi.fn(async () => undefined),
    onMove: vi.fn(),
    onReturnToSession: vi.fn(),
    onRevokeInvite: vi.fn(async () => undefined),
    reducedMotion: true,
    snapshot: snapshot(),
    stateCounts: { coding: 1, idle: 1, offline: 0 },
    users,
    working: false,
    ...overrides,
  };
  render(<ActiveRoomView {...props} />);
  return props;
}

describe('ActiveRoomView', () => {
  it('lets the owner end, leave, share and revoke, and moves between pods', () => {
    const props = renderRoom();

    expect(screen.getByRole('heading', { name: 'Pairing' })).toBeInTheDocument();
    expect(screen.getByText('Quick room')).toBeInTheDocument();
    expect(screen.getByTestId('floor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /End room/ }));
    fireEvent.click(screen.getByRole('button', { name: /Leave room/ }));
    fireEvent.click(screen.getByRole('button', { name: /Copy invite/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave table' }));
    fireEvent.click(screen.getByRole('button', { name: 'Join table' }));
    expect(props.onEnd).toHaveBeenCalled();
    expect(props.onLeave).toHaveBeenCalled();
    expect(props.onCopyInvite).toHaveBeenCalled();
    expect(props.onRevokeInvite).toHaveBeenCalled();
    expect(props.onMove).toHaveBeenCalledTimes(2);
    expect(screen.getByText('1 person here')).toBeInTheDocument();
    expect(screen.getByText('0 people here')).toBeInTheDocument();
  });

  it('hides owner controls and invites for a team room member without a position', () => {
    renderRoom({
      activeRoom: { ...roomData, expires_at: null, kind: 'team' },
      inviteId: null,
      inviteUrl: null,
      users: [users[1]],
    });

    expect(screen.queryByRole('button', { name: /End room/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Copy invite/ })).toBeNull();
    expect(screen.getByText('Team room')).toBeInTheDocument();
    expect(screen.getByText('Persistent team room')).toBeInTheDocument();
  });

  it('shows a fresh invite without a revoke action when its id is unknown', () => {
    renderRoom({ inviteId: null });

    expect(screen.getByRole('button', { name: /Copy invite/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).toBeNull();
  });

  it('shows the live session with partners, and the return grace period', () => {
    vi.useFakeTimers();
    const session = {
      leaving_deadlines: {},
      participants: [
        { user_id: 'me', username: 'me' },
        { user_id: 'b', username: 'bob' },
      ],
      session_id: 's',
      started_at: 1400,
      zone_id: 'z1',
    };
    renderRoom({ activeSession: session, snapshot: snapshot({ sessions: [session] }) });
    expect(screen.getByText('With bob')).toBeInTheDocument();
    expect(screen.getByText('10m')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('11m')).toBeInTheDocument();

    const props = renderRoom({
      activeSession: {
        ...session,
        leaving_deadlines: { me: 2300 },
        participants: [session.participants[0]],
      },
    });
    expect(screen.getByText('Your table — waiting for a teammate')).toBeInTheDocument();
    expect(screen.getByText('Return within 5m')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Return to session' }));
    expect(props.onReturnToSession).toHaveBeenCalled();
  });
});

describe('LobbyView', () => {
  const team: PresenceV2Room = {
    ended_at: null,
    expires_at: null,
    id: 't',
    kind: 'team',
    name: 'Core team',
    team_id: 'x',
  };
  const quick: PresenceV2Room = {
    ...team,
    expires_at: '2026-10-01T10:00:00Z',
    id: 'q',
    kind: 'adhoc',
    name: 'Friday',
  };

  function renderLobby(overrides: Partial<React.ComponentProps<typeof LobbyView>> = {}) {
    const props = {
      adhocRooms: [quick],
      error: null,
      expiry: '86400',
      loading: false,
      onCancelPreview: vi.fn(),
      onCreate: vi.fn(async () => undefined),
      onExpiryChange: vi.fn(),
      onJoin: vi.fn(async () => undefined),
      onOpenRoom: vi.fn(),
      onRefresh: vi.fn(async () => undefined),
      onRoomNameChange: vi.fn(),
      previewUnavailable: false,
      roomName: 'Pairing',
      roomPreview: roomData,
      teamRooms: [team],
      working: false,
      ...overrides,
    };
    const view = render(<LobbyView {...props} />);
    return { props, view };
  }

  it('previews, joins, lists rooms and creates a room with Enter', () => {
    const { props } = renderLobby();

    expect(screen.getByText(/2 co-working pods/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Join room/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: /Core team/ }));
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Friday pairing'), {
      target: { value: 'x' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Room expiry' }), {
      target: { value: '3600' },
    });
    fireEvent.submit(screen.getByPlaceholderText('e.g. Friday pairing').closest('form')!);
    expect(props.onJoin).toHaveBeenCalled();
    expect(props.onCancelPreview).toHaveBeenCalled();
    expect(props.onOpenRoom).toHaveBeenCalledWith(team);
    expect(props.onRefresh).toHaveBeenCalled();
    expect(props.onRoomNameChange).toHaveBeenCalledWith('x');
    expect(props.onExpiryChange).toHaveBeenCalledWith('3600');
    expect(props.onCreate).toHaveBeenCalled();
    expect(screen.getByText('Recent quick rooms')).toBeInTheDocument();
  });

  it('refuses to create without a name or while busy, and shows empty, loading and error states', () => {
    const { props, view } = renderLobby({
      adhocRooms: [],
      error: 'Presence is unavailable',
      previewUnavailable: true,
      roomName: '  ',
      roomPreview: { ...roomData, kind: 'team', zones: [zone] },
      teamRooms: [],
      working: true,
    });

    expect(screen.getByText('This room or invite has expired.')).toBeInTheDocument();
    expect(screen.getByText(/No team rooms yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Creating/ })).toBeDisabled();
    fireEvent.submit(screen.getByPlaceholderText('e.g. Friday pairing').closest('form')!);
    expect(props.onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(props.onRefresh).toHaveBeenCalled();
    view.unmount();

    const loadingLobby = renderLobby({
      loading: true,
      roomPreview: { ...roomData, zones: [zone] },
    });
    expect(screen.getByText(/1 co-working pod$/)).toBeInTheDocument();
    expect(screen.queryByText('Team rooms')).toBeNull();
    loadingLobby.view.unmount();

    renderLobby({ roomPreview: null });
    expect(screen.queryByText('Join preview')).toBeNull();
  });
});

describe('guide and availability', () => {
  it('explains the three states', () => {
    render(<PresenceGuide />);

    expect(screen.getByText('Editor activity in the last 2 minutes')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows a skeleton while checking and a clear message when disabled', () => {
    const { container, rerender } = render(<AvailabilityMessage loading unavailable={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Checking Presence availability');

    rerender(<AvailabilityMessage loading={false} unavailable />);
    expect(screen.getByRole('heading')).toHaveTextContent(/enabled on this server/);

    rerender(<AvailabilityMessage loading={false} unavailable={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
