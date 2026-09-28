import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { HistoryList } from '@/components/presence/HistoryList';
import { OfficeMediaPanel } from '@/components/presence/OfficeMedia';
import {
  buildGroups,
  PixelOfficeDirectory,
  zoneSwatch,
} from '@/components/presence/PixelOfficeDirectory';
import { PixelOfficeDock } from '@/components/presence/PixelOfficeDock';
import { OFFICE_TOOLS, PixelOfficeToolRail } from '@/components/presence/PixelOfficeToolRail';
import { PresenceHeader } from '@/components/presence/PresenceHeader';
import type { OfficeChrome } from '@/hooks/use-office-chrome';
import type { OfficeMedia } from '@/hooks/use-office-media';
import type { PresenceHistoryItem } from '@/lib/wakaclock/types';
import type { PresenceUser } from '@/types/presence';

vi.mock('@/hooks/use-office-media', () => ({ Track: { Kind: { Audio: 'audio' } } }));

function user(overrides: Partial<PresenceUser> = {}): PresenceUser {
  return {
    id: 'u1',
    isCurrentUser: false,
    status: 'coding',
    username: 'alice',
    x: 50,
    y: 50,
    zoneId: null,
    ...overrides,
  };
}

const zones = [
  { id: 'z1', label: 'Table A' },
  { id: 'z2', label: 'Table B' },
];

describe('PresenceHeader', () => {
  it('shows the room, a live stream and your own state', () => {
    render(
      <PresenceHeader
        connection="live"
        partyCount={3}
        presenceState="idle"
        roomName="Pairing"
        username="me"
      />
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Presence / Pairing');
    expect(screen.getByRole('status')).toHaveTextContent('Live');
    expect(screen.getByText('in room').parentElement).toHaveTextContent('3 in room');
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('offers a reconnect when the stream gave up, and stays minimal in the lobby', () => {
    const onReconnect = vi.fn();
    const { rerender } = render(
      <PresenceHeader connection="stale" onReconnect={onReconnect} reconnectStopped />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting');
    fireEvent.click(screen.getByRole('button', { name: /Reconnect/ }));
    expect(onReconnect).toHaveBeenCalled();

    rerender(<PresenceHeader connection="connecting" username="me" />);
    expect(screen.getByRole('status')).toHaveTextContent('Connecting');
    expect(screen.queryByText('Coding')).toBeNull();

    rerender(<PresenceHeader />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Presence$/);
  });
});

describe('PixelOfficeToolRail', () => {
  it('opens a panel by its OfficeTools id and closes it on a second click', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<PixelOfficeToolRail active={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Meeting rooms' }));
    expect(onSelect).toHaveBeenLastCalledWith('Meeting chambers');

    rerender(<PixelOfficeToolRail active="Meeting chambers" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: 'Meeting rooms' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Meeting rooms' }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(OFFICE_TOOLS.map((tool) => tool.panel)).toContain('Office settings');
  });
});

function chrome(overrides: Partial<OfficeChrome> = {}): OfficeChrome {
  return {
    camera: false,
    isFullscreen: false,
    mic: false,
    pushReaction: vi.fn(),
    reactions: [],
    screenShare: false,
    toggleCamera: vi.fn(),
    toggleFullscreen: vi.fn(),
    toggleMic: vi.fn(),
    toggleScreenShare: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    zoomPercent: 100,
    ...overrides,
  };
}

describe('PixelOfficeDock', () => {
  it('explains missing media instead of showing controls that cannot work', () => {
    const controls = chrome();
    const ref = createRef<HTMLElement>();
    render(
      <PixelOfficeDock
        canReturnToDesk={false}
        chrome={controls}
        fullscreenTargetRef={ref}
        mediaAvailable={false}
        mediaStatus="Media unavailable"
        onReturnToDesk={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Pod audio is not set up on this server');
    expect(screen.queryByRole('button', { name: /microphone/ })).toBeNull();
    expect(screen.getByRole('button', { name: /My desk/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enter full screen' }));
    expect(controls.zoomIn).toHaveBeenCalled();
    expect(controls.zoomOut).toHaveBeenCalled();
    expect(controls.toggleFullscreen).toHaveBeenCalled();
  });

  it('shows working media toggles once pod audio is connected', () => {
    const controls = chrome({ camera: true, isFullscreen: true, mic: true, screenShare: true });
    const onReturn = vi.fn();
    render(
      <PixelOfficeDock
        canReturnToDesk
        chrome={controls}
        fullscreenTargetRef={createRef<HTMLElement>()}
        mediaAvailable
        mediaReady
        mediaStatus="Pod audio connected"
        onReturnToDesk={onReturn}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Pod audio connected');
    fireEvent.click(screen.getByRole('button', { name: 'Mute microphone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Turn camera off' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing screen' }));
    fireEvent.click(screen.getByRole('button', { name: /My desk/ }));
    expect(controls.toggleMic).toHaveBeenCalled();
    expect(controls.toggleCamera).toHaveBeenCalled();
    expect(controls.toggleScreenShare).toHaveBeenCalled();
    expect(onReturn).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Exit full screen' })).toBeInTheDocument();
  });

  it('disables off toggles until media connects, showing the hook status', () => {
    render(
      <PixelOfficeDock
        canReturnToDesk={false}
        chrome={chrome()}
        fullscreenTargetRef={createRef<HTMLElement>()}
        mediaAvailable
        mediaStatus="Join a pod to talk"
        onReturnToDesk={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Join a pod to talk');
    expect(screen.getByRole('button', { name: 'Unmute microphone' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Turn camera on' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Share screen' })).toBeDisabled();
  });
});

describe('PixelOfficeDirectory', () => {
  const users = [
    user({ id: 'me', isCurrentUser: true, status: 'coding', username: 'me', zoneId: 'z1' }),
    user({ id: 'b', status: 'idle', username: 'bob', zoneId: 'z1' }),
    user({ id: 'c', status: 'offline', username: 'carol', zoneId: null }),
    user({ appearance: undefined, id: 'd', status: 'coding', username: 'dan', zoneId: 'z2' }),
  ];
  const sessions = [
    {
      leaving_deadlines: {},
      participants: [
        { user_id: 'me', username: 'me' },
        { user_id: 'b', username: 'bob' },
      ],
      session_id: 's1',
      started_at: 1000,
      zone_id: 'z1',
    },
    {
      leaving_deadlines: {},
      participants: [{ user_id: 'd', username: 'dan' }],
      session_id: 's2',
      started_at: 1300,
      zone_id: 'z2',
    },
  ];

  it('groups people by pod and describes their session', () => {
    const onChat = vi.fn();
    const onReact = vi.fn();
    render(
      <PixelOfficeDirectory
        onChat={onChat}
        onReact={onReact}
        reducedMotion={false}
        serverTime={1600}
        sessions={sessions}
        users={users}
        zones={zones}
      />
    );

    expect(screen.getByRole('heading', { name: '4 in this room' })).toBeInTheDocument();
    expect(screen.getByText('Co-working with bob · 10m')).toBeInTheDocument();
    expect(screen.getByText('At a table · 5m')).toBeInTheDocument();
    expect(
      screen.getByText('In the room, but no editor activity for over 5 minutes')
    ).toBeInTheDocument();
    expect(screen.getByText('Walking around')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Chat/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Wave' }));
    expect(onChat).toHaveBeenCalled();
    expect(onReact).toHaveBeenCalledWith('✋');
  });

  it('filters by status and search, and clears back to everyone', async () => {
    // Exiting rows animate out, so counts settle asynchronously.
    const rows = (count: number) =>
      waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(count));
    render(<PixelOfficeDirectory reducedMotion users={users} zones={zones} />);
    const filters = screen.getByRole('group', { name: 'Filter by status' });

    fireEvent.click(within(filters).getByRole('button', { name: /Idle/ }));
    await rows(1);
    fireEvent.click(within(filters).getByRole('button', { name: /Idle/ }));
    await rows(4);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nobody matches these filters.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Clear filters/ }));
    await rows(4);

    fireEvent.click(within(filters).getByRole('button', { name: /Coding/ }));
    fireEvent.click(within(filters).getByRole('button', { name: /^All/ }));
    await rows(4);
    expect(screen.queryByRole('group', { name: 'Office reactions' })).toBeNull();
  });

  it('says so when the room is empty', () => {
    render(<PixelOfficeDirectory reducedMotion users={[]} zones={zones} />);

    expect(screen.getByText('Nobody is here yet.')).toBeInTheDocument();
  });

  it('keeps a pod whose label matches, still honouring the status filter', () => {
    expect(buildGroups(zones, users, 'table a').map((group) => group.occupants.length)).toEqual([
      2,
    ]);
    expect(
      buildGroups(zones, users, 'table a', 'idle')[0].occupants.map((u) => u.username)
    ).toEqual(['bob']);
    expect(buildGroups(zones, users, 'car').map((group) => group.label)).toEqual([
      'Walking around',
    ]);
    expect(zoneSwatch('z1')).toMatch(/^#/);
  });
});

describe('HistoryList', () => {
  const item: PresenceHistoryItem = {
    duration_seconds: 3900,
    ended_at: null,
    ended_reason: 'active',
    participants: [
      { user_id: 'a', username: 'alice' },
      { user_id: 'b', username: 'bob' },
    ],
    room_id: 'r',
    room_name: 'Pairing',
    session_id: 's',
    source: 'zone',
    started_at: 1,
    team_id: null,
    your_joined_at: 1_700_000_000,
    your_left_at: null,
    your_projects: ['wakaclock'],
    zone_id: null,
  };

  it('renders loading, empty and filled states', () => {
    const { rerender } = render(<HistoryList items={[]} loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your co-working history');

    rerender(<HistoryList items={[]} />);
    expect(screen.getByText(/No co-working sessions today/)).toBeInTheDocument();

    rerender(<HistoryList items={[item, { ...item, session_id: 's2', your_projects: [] }]} />);
    expect(screen.getAllByText('Pairing')).toHaveLength(2);
    expect(screen.getAllByText('1h 5m')).toHaveLength(2);
    expect(screen.getAllByText(/alice, bob/)).toHaveLength(2);
    expect(screen.getAllByText('Your projects:')).toHaveLength(1);
  });
});

describe('OfficeMediaPanel', () => {
  function media(overrides: Partial<OfficeMedia> = {}): OfficeMedia {
    return {
      busy: false,
      camera: false,
      canConnect: false,
      error: null,
      mic: false,
      ready: false,
      reconnect: vi.fn(),
      screenShare: false,
      startAudio: vi.fn(),
      status: 'Join a pod to talk',
      toggleCamera: vi.fn(),
      toggleMic: vi.fn(),
      toggleScreenShare: vi.fn(),
      tracks: [],
      ...overrides,
    } as OfficeMedia;
  }

  it('renders nothing when there is nothing to act on', () => {
    const { container } = render(<OfficeMediaPanel media={media()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('offers playback, reconnect, errors and attaches tracks', () => {
    const detach = vi.fn();
    const video = document.createElement('video');
    const startAudio = vi.fn();
    const reconnect = vi.fn();
    const { rerender, unmount } = render(
      <OfficeMediaPanel
        media={media({
          ready: true,
          startAudio,
          status: 'Pod audio connected',
          tracks: [
            {
              key: 'v',
              track: { attach: () => video, detach, kind: 'video' },
              userId: 'b',
              username: 'bob',
            },
            {
              key: 'a',
              track: { attach: () => document.createElement('audio'), detach, kind: 'audio' },
              userId: 'b',
              username: 'bob',
            },
          ] as unknown as OfficeMedia['tracks'],
        })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enable playback' }));
    expect(startAudio).toHaveBeenCalled();
    expect(screen.getAllByText('bob')).toHaveLength(2);

    rerender(
      <OfficeMediaPanel
        media={media({ canConnect: true, error: 'Device permission denied', reconnect })}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Device permission denied');
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect media' }));
    expect(reconnect).toHaveBeenCalled();
    unmount();
    expect(detach).toHaveBeenCalled();
  });
});
