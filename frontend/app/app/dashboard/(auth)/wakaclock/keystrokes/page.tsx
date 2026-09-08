'use client';

import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { RequireUser } from '@/components/wakaclock/require-user';

import { KeystrokesPanel } from './components/keystrokes-panel';

export default function KeystrokesPage() {
  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        description="Keystrokes and privacy-preserving Copy/Paste metadata from the editor."
        title="Input Activity"
      />
      <RequireUser>
        <KeystrokesPanel />
      </RequireUser>
    </div>
  );
}
