'use client';

import * as React from 'react';

import {
  HeadphonesIcon,
  MaximizeIcon,
  MicIcon,
  MicOffIcon,
  MinimizeIcon,
  MinusIcon,
  MonitorUpIcon,
  PlusIcon,
  SquareArrowOutUpRightIcon,
  VideoIcon,
  VideoOffIcon,
} from 'lucide-react';

import type { OfficeChrome } from '@/hooks/use-office-chrome';

import styles from './presence-chrome.module.css';

interface PixelOfficeDockProps {
  canReturnToDesk: boolean;
  chrome: OfficeChrome;
  fullscreenTargetRef: React.RefObject<HTMLElement | null>;
  /** False when the server has no media backend configured (`office.media_available`). */
  mediaAvailable: boolean;
  mediaReady?: boolean;
  mediaStatus: string;
  onReturnToDesk: () => void;
}

type IconComponent = React.ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;

interface MediaToggleSpec {
  hideTextOnMobile?: boolean;
  offAria: string;
  offIcon: IconComponent;
  offText: string;
  onAria: string;
  onIcon: IconComponent;
  onText: string;
}

const MIC: MediaToggleSpec = {
  offAria: 'Unmute microphone',
  offIcon: MicOffIcon,
  offText: 'Mic off',
  onAria: 'Mute microphone',
  onIcon: MicIcon,
  onText: 'Mic on',
};
const CAMERA: MediaToggleSpec = {
  hideTextOnMobile: true,
  offAria: 'Turn camera on',
  offIcon: VideoOffIcon,
  offText: 'Cam off',
  onAria: 'Turn camera off',
  onIcon: VideoIcon,
  onText: 'Cam on',
};
const SCREEN: MediaToggleSpec = {
  hideTextOnMobile: true,
  offAria: 'Share screen',
  offIcon: MonitorUpIcon,
  offText: 'Screen',
  onAria: 'Stop sharing screen',
  onIcon: MonitorUpIcon,
  onText: 'Sharing',
};

/** A media control stays usable while on (so it can always be turned off). */
function MediaToggle({
  mediaReady,
  on,
  onClick,
  spec,
}: {
  mediaReady: boolean;
  on: boolean;
  onClick: () => void;
  spec: MediaToggleSpec;
}) {
  return (
    <button
      aria-label={on ? spec.onAria : spec.offAria}
      aria-pressed={on}
      className={`${styles.btn} ${on ? '' : styles.btnGhost}`}
      disabled={!mediaReady && !on}
      onClick={onClick}
      type="button"
    >
      {React.createElement(on ? spec.onIcon : spec.offIcon, {
        'aria-hidden': true,
        className: 'size-4',
      })}
      <span className={spec.hideTextOnMobile ? 'hidden sm:inline' : undefined}>
        {on ? spec.onText : spec.offText}
      </span>
    </button>
  );
}

/**
 * In-room controls. Media buttons only appear when the server can actually carry pod
 * audio/video; otherwise the dock says so instead of showing controls that cannot work.
 */
export function PixelOfficeDock({
  canReturnToDesk,
  chrome,
  fullscreenTargetRef,
  mediaAvailable,
  mediaReady = false,
  mediaStatus,
  onReturnToDesk,
}: PixelOfficeDockProps) {
  let mediaLabel = 'Pod audio is not set up on this server';
  if (mediaAvailable) mediaLabel = mediaReady ? 'Pod audio connected' : mediaStatus;

  return (
    <footer aria-label="Room controls" className={styles.dock}>
      <div className={styles.dockGroup}>
        <span
          className={`${styles.pill} ${mediaReady ? styles.coding : styles.offline}`}
          role="status"
        >
          <HeadphonesIcon aria-hidden className="size-3.5" />
          {mediaLabel}
        </span>
        {mediaAvailable ? (
          <>
            <MediaToggle
              mediaReady={mediaReady}
              on={chrome.mic}
              onClick={chrome.toggleMic}
              spec={MIC}
            />
            <MediaToggle
              mediaReady={mediaReady}
              on={chrome.camera}
              onClick={chrome.toggleCamera}
              spec={CAMERA}
            />
            <MediaToggle
              mediaReady={mediaReady}
              on={chrome.screenShare}
              onClick={chrome.toggleScreenShare}
              spec={SCREEN}
            />
          </>
        ) : null}
      </div>

      <div className={styles.dockGroup}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={!canReturnToDesk}
          onClick={onReturnToDesk}
          title={
            canReturnToDesk
              ? 'Walk back to your co-working table'
              : 'Join a table first to use this'
          }
          type="button"
        >
          <SquareArrowOutUpRightIcon aria-hidden className="size-4" />
          My desk
        </button>
        <div className={styles.zoom}>
          <button
            aria-label="Zoom out"
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnIcon}`}
            onClick={chrome.zoomOut}
            type="button"
          >
            <MinusIcon aria-hidden className="size-3.5" />
          </button>
          <span aria-live="polite">{chrome.zoomPercent}%</span>
          <button
            aria-label="Zoom in"
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnIcon}`}
            onClick={chrome.zoomIn}
            type="button"
          >
            <PlusIcon aria-hidden className="size-3.5" />
          </button>
        </div>
        <button
          aria-label={chrome.isFullscreen ? 'Exit full screen' : 'Enter full screen'}
          className={`${styles.btn} ${styles.btnIcon}`}
          onClick={() => chrome.toggleFullscreen(fullscreenTargetRef.current)}
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
