'use client';

import type { SpriteAppearance } from '@/components/presence/appearance';
import { PresenceSprite } from '@/components/presence/PresenceSprite';
import type { PresenceState } from '@/lib/wakaclock/types';

const WOOD_TOP = 'var(--office-desk-top)';
const WOOD_SIDE = 'var(--office-desk-side)';
const WOOD_EDGE = 'var(--office-desk-edge)';
const WOOD_HI = 'var(--office-desk-hi)';
const CHAIR = 'var(--office-chair)';
const CHAIR_HI = 'var(--office-chair-hi)';
const INK = '#1b2233';
const CREAM = '#fff4df';
const LIVE = 'var(--presence-live)';

interface DeskWorkstationProps {
  appearance: SpriteAppearance;
  /** The current user's own desk — adds the cream focus halo and a rising focus pip. */
  emphasis?: boolean;
  /** Play the one-shot sit-down drop + dust when the workstation first mounts. */
  entering?: boolean;
  reducedMotion: boolean;
  /** Screen wash, usually the pod's tint; falls back to terminal green. */
  screenTone?: string;
  size?: number;
  status: PresenceState;
  working?: boolean;
}

function poseClassFor(status: PresenceState, reducedMotion: boolean): string | undefined {
  if (reducedMotion) return undefined;
  if (status === 'coding') return 'office-anim-typing';
  if (status === 'idle') return 'office-anim-breathe';
  return undefined;
}

/** Three short "lines of code" plus a cursor, sized in % so they always fit the CRT
 * box. When animated each line wipes in left-to-right on a stagger, so the screen
 * reads as someone actively writing; widths are fixed so the loop is stable. */
function ScreenCode({ animate }: { animate: boolean }) {
  const lines = [
    { delay: '0s', top: 14, width: 62 },
    { delay: '0.5s', top: 40, width: 44 },
    { delay: '1s', top: 64, width: 74 },
  ];
  return (
    <span className="absolute inset-[2px] overflow-hidden">
      {lines.map((line) => (
        <span
          className={animate ? 'office-crt-line absolute block' : 'absolute block'}
          key={line.top}
          style={{
            animationDelay: animate ? line.delay : undefined,
            background: 'rgb(180 255 214 / 88%)',
            height: '11%',
            left: '8%',
            top: `${line.top}%`,
            width: `${line.width}%`,
          }}
        />
      ))}
      <span
        className={animate ? 'office-crt-cursor absolute block' : 'absolute block'}
        style={{ background: CREAM, height: '15%', left: '8%', top: '84%', width: '12%' }}
      />
    </span>
  );
}

/**
 * A character seated at a workstation — the visual state a roster member takes on
 * while standing in a pod. The character keeps its own hair / outfit / accessory
 * and status pose; a desk, a CRT typing its own code, tapping hands, mug steam and
 * — for the current user — a focus halo and a rising `/` pip are layered around it.
 *
 * Presentational only. In `PresencePlayer` this sits *inside* the draggable button,
 * so dragging out of the pod stands the character back up.
 */
export function DeskWorkstation({
  appearance,
  emphasis = false,
  entering = false,
  reducedMotion,
  screenTone,
  size = 96,
  status,
  working = status === 'coding',
}: DeskWorkstationProps) {
  const height = Math.round(size * 1.04);
  // The current user's explicit seated pose is independent of heartbeat recency.
  const offline = status === 'offline' && !working;
  const showTyping = working && !offline && !reducedMotion;
  const pose = poseClassFor(working && !offline ? 'coding' : status, reducedMotion);
  const screen = offline ? '#12211a' : (screenTone ?? '#0c2a1c');

  return (
    <div className="relative shrink-0" style={{ height, width: size }}>
      {emphasis ? <span aria-hidden className="office-self-halo absolute -inset-4" /> : null}

      {/* Back plate: cast shadow + chair, behind the character. */}
      <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 120 124">
        <ellipse cx="60" cy="117" fill="rgb(21 20 66 / 32%)" rx="42" ry="8" />
        <rect fill={CHAIR} height="40" rx="10" width="40" x="40" y="40" />
        <rect fill={CHAIR_HI} height="7" rx="3" width="34" x="43" y="44" />
      </svg>

      {/* The character. `left-1/2 -translate-x-1/2` stays on this element; the sit-down
          and status-pose transforms live on nested wrappers so they never clobber it. */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: `${Math.round(size * 0.17)}px`, width: `${Math.round(size * 0.54)}px` }}
      >
        <div className={entering && !reducedMotion ? 'office-anim-sitdown' : undefined}>
          <div className={pose}>
            <PresenceSprite
              accentColor={appearance.accentColor}
              accessory={appearance.accessory}
              color={appearance.shirtColor}
              hairColor={appearance.hairColor}
              hairStyle={appearance.hairStyle}
              outfit={appearance.outfit}
              reducedMotion={reducedMotion}
              seated
              size={Math.round(size * 0.54)}
              skinColor={appearance.skinColor}
              status={status}
            />
          </div>
        </div>
      </div>

      {/* Front plate: monitor (left, clear of the face), desk, keyboard, hands, mug,
          plant — drawn over the character so it reads as sitting at the desk. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 120 124"
      >
        {/* monitor: bezel + stand, screen wash is redrawn by the CRT box below */}
        <rect fill={INK} height="9" width="6" x="22" y="65" />
        <rect fill="#2b3450" height="3" rx="1.5" width="20" x="15" y="73" />
        <rect fill={INK} height="30" rx="4" width="40" x="4" y="36" />
        <rect fill={screen} height="22" rx="2" width="32" x="8" y="40" />

        {/* hard offset shadow, then desk slab + lit front edge + legs + front panel */}
        <path d="M4 74 H116 L120 86 H0 Z" fill="rgb(21 20 66 / 28%)" transform="translate(3 4)" />
        <rect fill={WOOD_EDGE} height="40" width="7" x="18" y="84" />
        <rect fill={WOOD_EDGE} height="40" width="7" x="95" y="84" />
        <path d="M8 80 H112 V116 H8 Z" fill={WOOD_SIDE} />
        <path d="M4 72 H116 L120 84 H0 Z" fill={WOOD_TOP} />
        <path d="M0 84 H120 V87 H0 Z" fill={WOOD_HI} opacity="0.5" />

        {/* keyboard on the desk top */}
        <path d="M50 74 H98 L102 82 H46 Z" fill="#d7d9e4" />
        <path d="M50 74 H98 L98.6 76 H49.4 Z" fill="#f2f3f8" />
        <path d="M54 77 H92 M56 80 H90" stroke="#9aa0b4" strokeWidth="0.8" />

        {/* forearms + tapping hands reaching from behind the desk to the keys */}
        {offline ? null : (
          <>
            <g className={showTyping ? 'office-anim-keys-l' : undefined}>
              <path
                d="M56 72 q4 -6 10 -4"
                fill="none"
                stroke={appearance.shirtColor}
                strokeLinecap="round"
                strokeWidth="5"
              />
              <circle cx="66" cy="73" fill={appearance.skinColor} r="3.4" />
            </g>
            <g className={showTyping ? 'office-anim-keys-r' : undefined}>
              <path
                d="M90 72 q-4 -6 -10 -4"
                fill="none"
                stroke={appearance.shirtColor}
                strokeLinecap="round"
                strokeWidth="5"
              />
              <circle cx="80" cy="73" fill={appearance.skinColor} r="3.4" />
            </g>
          </>
        )}

        {/* mug (with steam while coding) + a small desk plant, both on the desk top */}
        <rect fill={appearance.accentColor} height="8" rx="1" width="8" x="101" y="64" />
        <path d="M109 65 q4 1 3 5" fill="none" stroke={appearance.accentColor} strokeWidth="1.6" />
        {showTyping ? (
          <path
            className="office-anim-steam"
            d="M104 63 q-1 -3 1 -6"
            fill="none"
            stroke={CREAM}
            strokeLinecap="round"
            strokeWidth="1.6"
          />
        ) : null}
        <rect fill={CREAM} height="6" rx="1" width="7" x="9" y="66" />
        <path
          d="M12 66 q-3 -4 0 -8 M12 66 q3 -3 1 -8"
          fill="none"
          stroke="#3f8f57"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>

      {/* Screen content in its own CRT box so the scanline overlay + glow apply.
          Matches the SVG monitor screen: x8 y40 w32 h22 of a 120x124 viewBox. */}
      <span
        aria-hidden
        className="office-crt absolute overflow-hidden rounded-[2px]"
        style={{
          background: screen,
          height: `${Math.round(size * 0.184)}px`,
          left: `${Math.round(size * 0.067)}px`,
          top: `${Math.round(size * 0.323)}px`,
          width: `${Math.round(size * 0.267)}px`,
        }}
      >
        {offline ? null : <ScreenCode animate={showTyping} />}
      </span>

      {emphasis && showTyping ? (
        <span
          aria-hidden
          className="office-focus-pip absolute text-[9px] font-bold"
          style={{
            color: LIVE,
            left: `${Math.round(size * 0.12)}px`,
            top: `${Math.round(size * 0.2)}px`,
          }}
        >
          /
        </span>
      ) : null}

      {entering && !reducedMotion ? (
        <span
          aria-hidden
          className="office-poof absolute bottom-[15%] left-1/2 size-6 rounded-full"
          style={{ background: 'rgb(255 249 233 / 45%)' }}
        />
      ) : null}
    </div>
  );
}
