import { AppWindow, Code2, MessagesSquare, Palette, UsersRound } from 'lucide-react';
import { categoryLabel } from '../lib/format';
import type { AppRule, DesktopCategory, DesktopSettings } from '../types';
import { Toggle } from './Toggle';

const categories: DesktopCategory[] = [
  'coding',
  'building',
  'debugging',
  'designing',
  'modeling',
  'meeting',
  'communicating',
];

function iconFor(category: DesktopCategory) {
  if (category === 'coding' || category === 'building' || category === 'debugging') return <Code2 />;
  if (category === 'designing' || category === 'modeling') return <Palette />;
  if (category === 'meeting') return <UsersRound />;
  return <MessagesSquare />;
}

interface AppsPanelProps {
  settings: DesktopSettings;
  saving: boolean;
  onChange: (settings: DesktopSettings) => void;
}

export function AppsPanel({ settings, saving, onChange }: AppsPanelProps) {
  const updateRule = (id: string, patch: Partial<AppRule>) => {
    onChange({
      ...settings,
      rules: settings.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    });
  };

  return (
    <div className="section-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">MONITORED APPS</p>
          <h1>Application rules</h1>
          <p>One rule works across macOS bundle identifiers and Windows executable names.</p>
        </div>
        <div className="header-chip"><AppWindow size={15} /> {settings.rules.filter((rule) => rule.enabled).length} enabled</div>
      </header>

      <section className="card table-card">
        <div className="app-table-head">
          <span>Application</span><span>Category</span><span>Tracking</span>
        </div>
        <div className="app-table-body">
          {settings.rules.map((rule) => (
            <div className="app-rule-row" key={rule.id}>
              <div className="app-rule-main">
                <span className="rule-icon">{iconFor(rule.category)}</span>
                <div>
                  <strong>{rule.label}</strong>
                  <span>{rule.identifiers.join(' · ')}</span>
                </div>
              </div>
              <select
                aria-label={`${rule.label} category`}
                className="select-control"
                disabled={saving}
                onChange={(event) => updateRule(rule.id, { category: event.target.value as DesktopCategory })}
                value={rule.category}
              >
                {categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
              </select>
              <div className="rule-toggle-cell">
                <Toggle checked={rule.enabled} disabled={saving} label={`Track ${rule.label}`} onChange={(enabled) => updateRule(rule.id, { enabled })} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="info-card">
        Unknown applications are ignored by default. This avoids silently classifying every foreground app as coding and keeps desktop tracking privacy-first.
      </div>
    </div>
  );
}
