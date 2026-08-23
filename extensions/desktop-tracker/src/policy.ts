/** Platform-neutral policy layer for the native foreground-app tracker.
 * Native adapters (macOS NSWorkspace, Windows UI Automation, Linux X11/Wayland)
 * must call this before constructing an event. The policy never receives raw window
 * titles when title consent is disabled.
 */

export interface DesktopPrivacyPolicy {
  afkTimeoutMs: number;
  privateMode: boolean;
  titleTracking: boolean;
  deniedAppNames: string[];
  deniedWindowPatterns: string[];
}

export interface DesktopActivity {
  app: string;
  category: 'coding' | 'designing' | 'communicating' | 'browsing';
  entity: string;
  entity_type: 'app' | 'file' | 'url';
  time: number;
  title?: string;
}

export const DEFAULT_POLICY: DesktopPrivacyPolicy = {
  afkTimeoutMs: 15 * 60 * 1000,
  privateMode: false,
  titleTracking: false,
  deniedAppNames: ['1Password', 'Keychain Access', 'KeePass', 'LastPass'],
  deniedWindowPatterns: ['bank', 'medical', 'health', 'password', 'incognito', 'private'],
};

export function sanitizeActivity(
  app: string,
  windowTitle: string | undefined,
  now = Date.now(),
  policy: DesktopPrivacyPolicy = DEFAULT_POLICY
): DesktopActivity | null {
  if (policy.privateMode || policy.deniedAppNames.some((name) => app.toLowerCase().includes(name.toLowerCase()))) {
    return null;
  }
  const title = windowTitle?.trim() ?? '';
  if (policy.deniedWindowPatterns.some((pattern) => title.toLowerCase().includes(pattern))) {
    return null;
  }
  return {
    app,
    category: 'coding',
    entity: app,
    entity_type: 'app',
    time: now / 1000,
    ...(policy.titleTracking && title ? { title: title.slice(0, 256) } : {}),
  };
}
