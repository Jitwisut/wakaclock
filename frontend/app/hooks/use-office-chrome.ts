'use client';

import * as React from 'react';

/** Browser viewport controls. Shared reactions and devices are supplied by the office API and media hook. */
export interface OfficeChrome {
  camera: boolean;
  isFullscreen: boolean;
  mic: boolean;
  pushReaction: (emoji: string) => void;
  reactions: OfficeReaction[];
  screenShare: boolean;
  toggleCamera: () => void;
  toggleFullscreen: (element: HTMLElement | null) => void;
  toggleMic: () => void;
  toggleScreenShare: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomPercent: number;
}

export interface OfficeReaction {
  emoji: string;
  id: number | string;
}

const ZOOM_MAX = 140;
const ZOOM_MIN = 60;
const ZOOM_STEP = 20;

export function useOfficeChrome() {
  const [zoomPercent, setZoomPercent] = React.useState(100);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  React.useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const zoomIn = React.useCallback(
    () => setZoomPercent((value) => Math.min(ZOOM_MAX, value + ZOOM_STEP)),
    []
  );
  const zoomOut = React.useCallback(
    () => setZoomPercent((value) => Math.max(ZOOM_MIN, value - ZOOM_STEP)),
    []
  );

  const toggleFullscreen = React.useCallback((element: HTMLElement | null) => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
      return;
    }
    if (element && typeof element.requestFullscreen === 'function') {
      void element.requestFullscreen().catch(() => undefined);
    }
  }, []);

  return { isFullscreen, toggleFullscreen, zoomIn, zoomOut, zoomPercent };
}
