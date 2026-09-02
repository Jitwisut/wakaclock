import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { AppsPanel } from './components/AppsPanel';
import { Overview } from './components/Overview';
import { PrivacyPanel } from './components/PrivacyPanel';
import { Sidebar, type Section } from './components/Sidebar';
import { desktopApi } from './lib/tauri';
import type { DashboardSnapshot, DesktopSettings } from './types';

function App() {
  const [section, setSection] = useState<Section>('overview');
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await desktopApi.snapshot();
      setSnapshot(next);
      setError(null);
    } catch (value) {
      setError(String(value));
    }
  }, []);

  useEffect(() => {
    Promise.all([desktopApi.settings(), desktopApi.snapshot()])
      .then(([nextSettings, nextSnapshot]) => {
        setSettings(nextSettings);
        setSnapshot(nextSnapshot);
      })
      .catch((value) => setError(String(value)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const updateSettings = useCallback(async (next: DesktopSettings) => {
    setSettings(next);
    setSaving(true);
    try {
      const saved = await desktopApi.updateSettings(next);
      setSettings(saved);
      await refresh();
      setError(null);
    } catch (value) {
      setError(String(value));
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const toggleTracking = useCallback(() => {
    if (!settings) return;
    void updateSettings({ ...settings, enabled: !settings.enabled });
  }, [settings, updateSettings]);

  const content = useMemo(() => {
    if (!settings) return <div className="loading-panel">Loading desktop settings…</div>;
    if (section === 'apps') return <AppsPanel onChange={updateSettings} saving={saving} settings={settings} />;
    if (section === 'privacy') return <PrivacyPanel onChange={updateSettings} saving={saving} settings={settings} />;
    return <Overview loading={loading} onRefresh={refresh} snapshot={snapshot} />;
  }, [loading, refresh, saving, section, settings, snapshot, updateSettings]);

  return (
    <div className="app-shell" data-theme-preset="retro-pixel">
      <Sidebar active={section} onSelect={setSection} tracking={Boolean(settings?.enabled && !settings?.private_mode)} />
      <main className="main-panel">
        <div className="topbar">
          <div className="topbar-drag" data-tauri-drag-region>
            <span className="topbar-label">ATOAXIS DESKTOP</span>
            <span className="topbar-platform">macOS + Windows</span>
          </div>
          <button className="button button-primary" disabled={!settings || saving} onClick={toggleTracking} type="button">
            {settings?.enabled ? <Pause size={15} /> : <Play size={15} />}
            {settings?.enabled ? 'Pause tracking' : 'Resume tracking'}
          </button>
        </div>
        {error && <div className="global-error">{error}</div>}
        <div className="content-scroll">{content}</div>
      </main>
    </div>
  );
}

export default App;
