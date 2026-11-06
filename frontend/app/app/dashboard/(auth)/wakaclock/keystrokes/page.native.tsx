'use client';

import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { RequireUser } from '@/components/wakaclock/require-user';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';

import { KeystrokesPanel } from './components/keystrokes-panel';

/** The page's range, in the toolbar; the panel reads the same URL range. */
function InputActivityRange() {
  const { start, end, setRange } = useWakaclockRange(14);
  return <RangePicker onChange={setRange} value={{ start, end }} />;
}

export default function KeystrokesPage() {
  return (
    <div className="flex flex-col gap-5">
      <WakaclockPageHeader
        actions={<InputActivityRange />}
        description="Keystrokes and privacy-preserving Copy/Paste metadata from the editor."
        title="Input Activity"
      />
      <RequireUser>
        <KeystrokesPanel />
      </RequireUser>
    </div>
  );
}
