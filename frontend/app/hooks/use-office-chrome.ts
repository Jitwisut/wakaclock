'use client';

import * as React from 'react';

/**
 * Local-only state for the PixelOffice chrome (dock + reactions). None of this is
 * backed by the presence API — the mic/camera/screen-share toggles, the zoom
 * readout and the floating reactions are a visual shell over the real
 * co-working surface, matching the reference prototype. `toggleFullscreen` is the
 * one control wired to a real browser API.
 */
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
  id: number;
}

const ZOOM_MAX = 140;
const ZOOM_MIN = 60;
const ZOOM_STEP = 20;
const REACTION_TTL_MS = 1100;

export function useOfficeChrome(): OfficeChrome {
  const [mic, setMic] = React.useState(true);
  const [camera, setCamera] = React.useState(false);
  const [screenShare, setScreenShare] = React.useState(false);
  const [zoomPercent, setZoomPercent] = React.useState(100);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [reactions, setReactions] = React.useState<OfficeReaction[]>([]);
  const nextReactionIdRef = React.useRef(0);

  React.useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleMic = React.useCallback(() => setMic((value) => !value), []);
  const toggleCamera = React.useCallback(() => setCamera((value) => !value), []);
  const toggleScreenShare = React.useCallback(() => setScreenShare((value) => !value), []);

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

  const pushReaction = React.useCallback((emoji: string) => {
    const id = nextReactionIdRef.current;
    nextReactionIdRef.current += 1;
    setReactions((current) => [...current, { emoji, id }]);
    window.setTimeout(() => {
      setReactions((current) => current.filter((reaction) => reaction.id !== id));
    }, REACTION_TTL_MS);
  }, []);

  return {
    camera,
    isFullscreen,
    mic,
    pushReaction,
    reactions,
    screenShare,
    toggleCamera,
    toggleFullscreen,
    toggleMic,
    toggleScreenShare,
    zoomIn,
    zoomOut,
    zoomPercent,
  };
}
