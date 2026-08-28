import { EyeOff, Keyboard, LockKeyhole, ShieldCheck, Timer } from 'lucide-react';
import type { DesktopSettings } from '../types';
import { Toggle } from './Toggle';

interface PrivacyPanelProps {
  settings: DesktopSettings;
  saving: boolean;
  onChange: (settings: DesktopSettings) => void;
}

export function PrivacyPanel({ settings, saving, onChange }: PrivacyPanelProps) {
  const patch = (value: Partial<DesktopSettings>) => onChange({ ...settings, ...value });

  return (
    <div className="section-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">PRIVACY CONTROLS</p>
          <h1>Local-first tracking</h1>
          <p>Sanitization runs on the device before a desktop heartbeat can reach AtoAxis.</p>
        </div>
        <div className="header-chip safe"><ShieldCheck size={15} /> foreground only</div>
      </header>

      <div className="settings-grid">
        <SettingCard
          icon={<LockKeyhole />}
          title="Private mode"
          description="Immediately suppress every desktop heartbeat without changing app rules."
          control={<Toggle checked={settings.private_mode} disabled={saving} label="Private mode" onChange={(private_mode) => patch({ private_mode })} />}
        />
        <SettingCard
          icon={<EyeOff />}
          title="Window title consent"
          description="Off by default. Titles are requested only after you enable this. macOS also requires Accessibility permission; without it tracking safely falls back to app names only."
          control={<Toggle checked={settings.title_tracking} disabled={saving} label="Window title tracking" onChange={(title_tracking) => patch({ title_tracking })} />}
        />
        <SettingCard
          icon={<Timer />}
          title="Idle timeout"
          description="Tracking stops when there has been no input for the selected duration."
          control={
            <select className="select-control" disabled={saving} onChange={(event) => patch({ idle_timeout_seconds: Number(event.target.value) })} value={settings.idle_timeout_seconds}>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
              <option value={900}>15 minutes</option>
              <option value={1800}>30 minutes</option>
            </select>
          }
        />
        <SettingCard
          icon={<Keyboard />}
          title="Never captured"
          description="Keystrokes, clipboard contents, page contents and source code are outside this tracker's data model."
          control={<span className="locked-label">LOCKED</span>}
        />
      </div>

      <section className="card deny-card">
        <div className="card-heading-row">
          <div><p className="card-kicker">LOCAL DENYLIST</p><h2>Protected app names</h2></div>
          <span className="muted-text">{settings.denied_app_names.length} rules</span>
        </div>
        <div className="tag-list">
          {settings.denied_app_names.map((name) => <span className="deny-tag" key={name}>{name}</span>)}
        </div>
        <p className="muted-paragraph">Sensitive window patterns are filtered locally too: {settings.denied_window_patterns.join(', ')}.</p>
      </section>
    </div>
  );
}

function SettingCard({ icon, title, description, control }: { icon: React.ReactNode; title: string; description: string; control: React.ReactNode }) {
  return (
    <article className="card setting-card">
      <div className="setting-icon">{icon}</div>
      <div className="setting-copy"><h2>{title}</h2><p>{description}</p></div>
      <div className="setting-control">{control}</div>
    </article>
  );
}
