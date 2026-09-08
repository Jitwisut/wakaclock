'use client';

import type * as React from 'react';

import {
  MaximizeIcon,
  MicIcon,
  MicOffIcon,
  MinimizeIcon,
  MinusIcon,
  MonitorUpIcon,
  PlusIcon,
  ShirtIcon,
  SquareArrowOutUpRightIcon,
  VideoIcon,
  VideoOffIcon,
} from 'lucide-react';

import type { OfficeChrome } from '@/hooks/use-office-chrome';

const panel = 'var(--presence-panel)';
const border = 'var(--presence-border)';
const muted = 'var(--presence-text-muted)';
const live = 'var(--presence-live)';
const danger = 'var(--presence-danger)';
const headingFont = 'var(--font-presence-heading)';

interface PixelOfficeDockProps {
  canReturnToDesk: boolean;
  chrome: OfficeChrome;
  fullscreenTargetRef: React.RefObject<HTMLElement | null>;
  onLockedFeature: (label: string) => void;
  onReturnToDesk: () => void;
}

function DockButton({
  active,
  children,
  label,
  onClick,
  tone = 'neutral',
}: {
  active?: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'danger' | 'neutral';
}) {
  const background = active && tone === 'danger' ? 'rgba(255, 68, 56, 0.14)' : panel;
  const borderColor = active && tone === 'danger' ? danger : border;
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className="presence-pixel-shadow-sm presence-pixel-press flex items-center gap-2 border-2 px-3 py-2 text-xs font-bold"
      onClick={onClick}
      style={{ background, borderColor }}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

export function PixelOfficeDock({
  canReturnToDesk,
  chrome,
  fullscreenTargetRef,
  onLockedFeature,
  onReturnToDesk,
}: PixelOfficeDockProps) {
  return (
    <footer
      className="presence-pixel-shadow flex flex-wrap items-center justify-between gap-3 border-2 p-3"
      style={{ background: 'var(--presence-bg-soft)', borderColor: border }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center border-2 text-[10px] font-bold"
          style={{ background: panel, borderColor: live, color: live, fontFamily: headingFont }}
        >
          LV3
        </span>
        <div className="leading-tight">
          <p className="text-xs font-bold" style={{ fontFamily: headingFont }}>
            Spatial audio
          </p>
          <p className="text-[10px] font-bold" style={{ color: live }}>
            ● Low-latency proximity engine
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DockButton
          active={!chrome.mic}
          label={chrome.mic ? 'Mute microphone' : 'Unmute microphone'}
          onClick={chrome.toggleMic}
          tone="danger"
        >
          {chrome.mic ? (
            <MicIcon aria-hidden className="size-4" style={{ color: live }} />
          ) : (
            <MicOffIcon aria-hidden className="size-4" style={{ color: danger }} />
          )}
          <span>{chrome.mic ? 'Mic on' : 'Muted'}</span>
        </DockButton>

        <DockButton
          active={chrome.camera}
          label={chrome.camera ? 'Turn camera off' : 'Turn camera on'}
          onClick={chrome.toggleCamera}
        >
          {chrome.camera ? (
            <VideoIcon aria-hidden className="size-4" style={{ color: live }} />
          ) : (
            <VideoOffIcon aria-hidden className="size-4" style={{ color: muted }} />
          )}
          <span className="hidden sm:inline">{chrome.camera ? 'Cam on' : 'Cam off'}</span>
        </DockButton>

        <DockButton
          active={chrome.screenShare}
          label={chrome.screenShare ? 'Stop sharing screen' : 'Share screen'}
          onClick={chrome.toggleScreenShare}
        >
          <MonitorUpIcon
            aria-hidden
            className="size-4"
            style={{ color: chrome.screenShare ? live : muted }}
          />
          <span className="hidden sm:inline">{chrome.screenShare ? 'Sharing' : 'Screen'}</span>
        </DockButton>

        <DockButton label="Edit sprite" onClick={() => onLockedFeature('Sprite customizer')}>
          <ShirtIcon aria-hidden className="size-4" style={{ color: muted }} />
          <span className="hidden md:inline">Edit sprite</span>
        </DockButton>

        <button
          className="presence-pixel-shadow-sm presence-pixel-press flex items-center gap-1.5 border-2 px-3 py-2 text-xs font-bold text-white disabled:opacity-45"
          disabled={!canReturnToDesk}
          onClick={onReturnToDesk}
          style={{ background: danger, borderColor: border }}
          title={
            canReturnToDesk
              ? 'Walk back to your co-working table'
              : 'Join a table first to use this'
          }
          type="button"
        >
          <SquareArrowOutUpRightIcon aria-hidden className="size-4" />
          <span>My desk</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-1 border-2 p-1"
          style={{ background: panel, borderColor: border }}
        >
          <button
            aria-label="Zoom out"
            className="presence-pixel-press flex size-6 items-center justify-center"
            onClick={chrome.zoomOut}
            type="button"
          >
            <MinusIcon aria-hidden className="size-3" />
          </button>
          <span className="px-1 text-[10px] font-bold" style={{ fontFamily: headingFont }}>
            {chrome.zoomPercent}%
          </span>
          <button
            aria-label="Zoom in"
            className="presence-pixel-press flex size-6 items-center justify-center"
            onClick={chrome.zoomIn}
            type="button"
          >
            <PlusIcon aria-hidden className="size-3" />
          </button>
        </div>
        <button
          aria-label={chrome.isFullscreen ? 'Exit full screen' : 'Enter full screen'}
          className="presence-pixel-shadow-sm presence-pixel-press flex size-9 items-center justify-center border-2"
          onClick={() => chrome.toggleFullscreen(fullscreenTargetRef.current)}
          style={{ background: panel, borderColor: border }}
          title={chrome.isFullscreen ? 'Exit full screen' : 'Enter full screen'}
          type="button"
        >
          {chrome.isFullscreen ? (
            <MinimizeIcon aria-hidden className="size-4" />
          ) : (
            <MaximizeIcon aria-hidden className="size-4" />
          )}
        </button>
      </div>
    </footer>
  );
}
