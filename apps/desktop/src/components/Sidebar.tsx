import { Activity, AppWindow, LayoutDashboard, LockKeyhole, Settings2 } from 'lucide-react';

export type Section = 'overview' | 'apps' | 'privacy';

interface SidebarProps {
  active: Section;
  onSelect: (section: Section) => void;
  tracking: boolean;
}

const items = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
  { id: 'apps' as const, label: 'Monitored Apps', icon: AppWindow },
  { id: 'privacy' as const, label: 'Privacy', icon: LockKeyhole },
];

export function Sidebar({ active, onSelect, tracking }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <img alt="AtoAxis" className="brand-logo" src="/atoaxis-logo-mark.png" />
        <div>
          <strong className="brand-name">AtoAxis</strong>
          <span className="brand-subtitle">DESKTOP</span>
        </div>
      </div>

      <nav className="nav-list" aria-label="Desktop navigation">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            className="nav-item"
            data-active={active === id}
            key={id}
            onClick={() => onSelect(id)}
            type="button"
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      <div className="agent-card">
        <div className="agent-card-top">
          <span className="status-dot" data-active={tracking} />
          <strong>{tracking ? 'TRACKER ONLINE' : 'TRACKER PAUSED'}</strong>
        </div>
        <p>Foreground-only activity. No keystrokes, clipboard, page contents or source code.</p>
      </div>

      <div className="sidebar-footer">
        <Activity size={14} /> native tracker
        <span className="sidebar-footer-separator">·</span>
        <Settings2 size={14} /> v0.1
      </div>
    </aside>
  );
}
