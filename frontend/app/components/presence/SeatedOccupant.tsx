import { appearanceFor } from '@/components/presence/appearance';
import { PresenceSprite } from '@/components/presence/PresenceSprite';
import type { PresenceUser } from '@/types/presence';

const border = 'var(--presence-border)';
const live = 'var(--presence-live)';

/**
 * A roster member drawn seated at a workstation inside a pod, the way the
 * PixelOffice reference shows people — sprite next to a small CRT, on a desk bar.
 *
 * Purely presentational: the person's real position is still whatever the server
 * holds, `PresencePlayground` just chooses to render pod occupants here instead of
 * as a free-floating sprite (and renders each member exactly once). The current
 * user is never seated — they stay the draggable sprite so movement keeps working.
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
  const appearance = appearanceFor(user.id);
  let poseClass = '';
  if (!reducedMotion && user.status === 'coding') poseClass = ' office-anim-typing';
  else if (!reducedMotion && user.status === 'idle') poseClass = ' office-anim-breathe';

  return (
    <div className="pointer-events-none flex w-max flex-col items-center">
      <div className={`flex items-end gap-0.5${poseClass}`}>
        <PresenceSprite
          accentColor={appearance.accentColor}
          accessory={appearance.accessory}
          color={appearance.shirtColor}
          hairColor={appearance.hairColor}
          reducedMotion={reducedMotion}
          size={30}
          status={user.status}
        />
        <span className="mb-0.5 flex flex-col items-center">
          <span
            className="office-crt flex size-5 items-center justify-center border-2 p-[1px]"
            style={{ background: '#cbd5e1', borderColor: border }}
          >
            <span
              className="size-full border"
              style={{
                background: user.status === 'offline' ? '#1f2937' : screenTone,
                borderColor: border,
              }}
            />
          </span>
          <span className="h-1 w-1.5" style={{ background: '#9ca3af' }} />
        </span>
      </div>
      <span className="h-1.5 w-11 border-x-2 border-t-2" style={{ background: 'var(--office-desk-top)', borderColor: 'var(--office-desk-edge)' }} />
      <span
        className="presence-pixel-shadow-sm mt-1 max-w-[5.5rem] truncate border px-1 text-[8px] font-bold text-white"
        style={{ background: border, borderColor: border }}
      >
        {user.username}
        {user.status === 'coding' ? <span style={{ color: live }}> ●</span> : null}
      </span>
    </div>
  );
}
