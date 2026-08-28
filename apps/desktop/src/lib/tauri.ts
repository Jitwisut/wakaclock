import { invoke } from '@tauri-apps/api/core';
import type { DashboardSnapshot, DesktopSettings } from '../types';

export const desktopApi = {
  snapshot: () => invoke<DashboardSnapshot>('dashboard_snapshot'),
  settings: () => invoke<DesktopSettings>('get_settings'),
  updateSettings: (settings: DesktopSettings) =>
    invoke<DesktopSettings>('update_settings', { settings }),
  refreshNow: () => invoke<void>('refresh_now'),
};
