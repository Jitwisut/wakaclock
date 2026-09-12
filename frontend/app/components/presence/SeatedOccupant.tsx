import { appearanceFor } from '@/components/presence/appearance';
import { DeskWorkstation } from '@/components/presence/DeskWorkstation';
import type { PresenceUser } from '@/types/presence';

const border = 'var(--presence-border)';
const live = 'var(--presence-live)';

/**
 * A teammate drawn seated at a workstation inside a pod. Presentational: the
 * person's real position is still whatever the server holds — `PresencePlayground`
 * chooses to render pod occupants here (once each) instead of as a free sprite.
 * The current user is never routed through here; they keep the draggable sprite,
 * which swaps to its own `DeskWorkstation` in place while inside a pod.
 * Root is `pointer-events-none` so it never intercepts a drag across the pod.
 */
export function SeatedOccupant({
  reducedMotion,
  screenTone,
  user,
}: {
  reducedMotion: boolean;
  screenTone: string;
  user: PresenceUser;
}) {
  return (
    <div className="pointer-events-none flex w-max flex-col items-center">
      <DeskWorkstation
        appearance={user.appearance ?? appearanceFor(user.id)}
        reducedMotion={reducedMotion}
        screenTone={screenTone}
        size={92}
        status={user.status}
      />
      <span
        className="presence-character-name -mt-1 max-w-[6rem] truncate border px-1.5 py-0.5 text-[8px] font-bold text-white"
        style={{ background: border, borderColor: border }}
      >
        {user.username}
        {user.status === 'coding' ? <span style={{ color: live }}> ●</span> : null}
      </span>
    </div>
  );
}
