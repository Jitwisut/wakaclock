'use client';

interface RailItem {
  emoji: string;
  key: string;
  label: string;
  notify?: boolean;
}

const ITEMS: RailItem[] = [
  { emoji: '🗺️', key: 'map', label: 'Floor map' },
  { emoji: '👥', key: 'party', label: 'Party members' },
  { emoji: '📡', key: 'chambers', label: 'Meeting chambers', notify: false },
  { emoji: '📜', key: 'quests', label: 'Quests & sprints' },
];

const SETTINGS: RailItem = { emoji: '⚙️', key: 'settings', label: 'Office settings' };

const panel = 'var(--presence-panel)';
const border = 'var(--presence-border)';

function RailButton({
  item,
  onActivate,
}: {
  item: RailItem;
  onActivate: (item: RailItem) => void;
}) {
  return (
    <button
      aria-label={item.label}
      className="presence-pixel-shadow-sm presence-pixel-press relative flex size-10 items-center justify-center border-2 text-base"
      onClick={() => onActivate(item)}
      style={{ background: panel, borderColor: border }}
      title={item.label}
      type="button"
    >
      <span aria-hidden>{item.emoji}</span>
      {item.notify ? (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 size-2 border"
          style={{ background: 'var(--presence-danger)', borderColor: border }}
        />
      ) : null}
    </button>
  );
}

export function PixelOfficeToolRail({
  onLockedFeature,
}: {
  onLockedFeature: (label: string) => void;
}) {
  const activate = (item: RailItem) => {
    onLockedFeature(item.label);
  };

  return (
    <nav
      aria-label="Office tools"
      className="flex w-14 shrink-0 flex-col items-center gap-3 border-2 p-3"
      style={{ background: 'var(--presence-bg-soft)', borderColor: border }}
    >
      {ITEMS.map((item) => (
        <RailButton item={item} key={item.key} onActivate={activate} />
      ))}
      <span aria-hidden className="flex-1" />
      <RailButton item={SETTINGS} onActivate={activate} />
    </nav>
  );
}
