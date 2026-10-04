import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One snapshot request at a time, with at most one queued follow-up. The
  // command can outlive the 5s interval while the server is slow, and a request
  // per tick used to pile up (OFF-07).
  const inFlight = useRef(false);
  const rerunQueued = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      // A late result must not repaint an unmounted view.
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      rerunQueued.current = true;
      return;
    }
    inFlight.current = true;
    if (mounted.current) setRefreshing(true);
    try {
      const next = await desktopApi.snapshot();
      if (!mounted.current) return;
      setSnapshot(next);
      setError(null);
    } catch (value) {
      if (mounted.current) setError(String(value));
    } finally {
      // Released even on failure, so one error cannot stop every later refresh.
      inFlight.current = false;
      if (mounted.current) setRefreshing(false);
    }
    if (rerunQueued.current && mounted.current) {
      rerunQueued.current = false;
      await refresh();
    }
  }, []);

  useEffect(() => {
    // The initial load goes through the same coordinator as the interval, so
    // the first tick cannot race it.
    Promise.all([desktopApi.settings(), refresh()])
      .then(([nextSettings]) => {
        if (mounted.current) setSettings(nextSettings);
      })
      .catch((value) => {
        if (mounted.current) setError(String(value));
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);
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
    return <Overview loading={loading || refreshing} onRefresh={refresh} snapshot={snapshot} />;
  }, [loading, refreshing, refresh, saving, section, settings, snapshot, updateSettings]);

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
