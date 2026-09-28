'use client';

import {
  Building2Icon,
  DoorClosedIcon,
  MessageSquareIcon,
  SettingsIcon,
  ShirtIcon,
  TimerIcon,
} from 'lucide-react';

import styles from './presence-chrome.module.css';

/**
 * Panel ids are the exact strings `OfficeTools` switches on — rename one there first.
 * "Party members" and "Floor map" used to be entries here too; the live roster and the
 * floor are now always on screen, so they no longer need a button of their own.
 */
export const OFFICE_TOOLS = [
  { icon: MessageSquareIcon, label: 'Chat', panel: 'Chat' },
  { icon: Building2Icon, label: 'Floors', panel: 'Floors' },
  { icon: DoorClosedIcon, label: 'Meeting rooms', panel: 'Meeting chambers' },
  { icon: TimerIcon, label: 'Sprints', panel: 'Quests & sprints' },
  { icon: ShirtIcon, label: 'Sprite', panel: 'Sprite customizer' },
  { icon: SettingsIcon, label: 'Room settings', panel: 'Office settings' },
] as const;

/** The single entry point for every office panel. Clicking the open panel closes it. */
export function PixelOfficeToolRail({
  active,
  onSelect,
}: {
  active: null | string;
  onSelect: (panel: null | string) => void;
}) {
  return (
    <nav aria-label="Office tools" className={styles.tools}>
      {OFFICE_TOOLS.map((tool) => (
        <button
          aria-pressed={active === tool.panel}
          className={styles.tool}
          key={tool.panel}
          onClick={() => onSelect(active === tool.panel ? null : tool.panel)}
          type="button"
        >
          <tool.icon aria-hidden className="size-4" />
          {tool.label}
        </button>
      ))}
    </nav>
  );
}
