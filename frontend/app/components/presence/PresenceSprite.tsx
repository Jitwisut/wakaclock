'use client';

import { useId } from 'react';

import type {
  SpriteAccessory,
  SpriteHairStyle,
  SpriteOutfit,
} from '@/components/presence/appearance';
import type { PresenceState } from '@/lib/wakaclock/types';

interface PresenceSpriteProps {
  accentColor?: string;
  accessory?: SpriteAccessory;
  color: string;
  hairColor?: string;
  hairStyle?: SpriteHairStyle;
  isDragging?: boolean;
  outfit?: SpriteOutfit;
  reducedMotion: boolean;
  size?: number;
  skinColor?: string;
  status: PresenceState;
}

const HAIR_PATHS: Record<SpriteHairStyle, string> = {
  swept: 'M25 42 C17 17 36 10 54 15 C71 15 77 25 72 42 L63 34 L60 24 C51 36 34 26 25 42Z',
  curls:
    'M23 41 C13 36 18 28 21 27 C15 18 25 13 31 16 C31 6 43 7 47 12 C54 5 63 11 63 16 C75 12 82 23 75 30 C82 38 72 44 68 40 L63 29 Q45 37 28 29Z',
  bob: 'M20 60 L21 32 C20 7 72 6 75 31 L79 61 L64 64 L64 30 Q47 38 30 30 L32 63Z',
  bun: 'M27 41 C16 15 41 12 48 16 C65 11 79 23 71 42 L62 29 Q44 34 30 28Z',
  spiky:
    'M23 41 L17 27 L27 28 L24 14 L37 19 L42 8 L49 17 L61 10 L63 21 L76 20 L71 43 L61 30 L50 33 L40 27 L29 33Z',
};

function CharacterAccessory({ accessory, accent }: { accent: string; accessory: SpriteAccessory }) {
  switch (accessory) {
    case 'headset': {
      return (
        <g stroke="#343446" strokeWidth="3">
          <path d="M22 39 C16 7 74 6 76 36" fill="none" />
          <rect fill={accent} height="17" rx="5" width="9" x="18" y="33" />
          <rect fill={accent} height="17" rx="5" width="9" x="70" y="32" />
          <path d="M75 46 Q79 56 64 55" fill="none" />
          <rect fill="#343446" height="4" rx="2" stroke="none" width="8" x="59" y="53" />
        </g>
      );
    }
    case 'glasses': {
      return (
        <g fill="#d4ecf5" fillOpacity="0.24" stroke="#343446" strokeWidth="2.5">
          <rect height="12" rx="4" width="16" x="32" y="38" />
          <rect height="12" rx="4" width="14" x="55" y="37" />
          <path d="M48 42 Q51 40 55 42 M26 40 L32 42" fill="none" />
        </g>
      );
    }
    case 'cap': {
      return (
        <g>
          <path d="M23 29 Q22 9 48 11 Q70 11 73 30Z" fill={accent} />
          <path d="M24 28 Q58 22 81 29 Q85 36 65 35 L23 33Z" fill={accent} />
          <path
            d="M24 30 Q58 24 80 31"
            fill="none"
            stroke="#343446"
            strokeOpacity="0.25"
            strokeWidth="3"
          />
          <path d="M48 15 L48 23" stroke="white" strokeOpacity="0.5" strokeWidth="3" />
        </g>
      );
    }
    case 'beanie': {
      return (
        <g fill={accent}>
          <circle cx="47" cy="10" r="6" />
          <path d="M22 29 Q22 9 47 12 Q72 11 73 29Z" />
          <rect height="10" rx="4" width="54" x="21" y="25" />
          <path
            d="M32 20 L31 25 M43 18 L43 25 M55 18 L56 25 M65 22 L66 26"
            stroke="#343446"
            strokeOpacity="0.2"
            strokeWidth="2"
          />
          <rect fill="#fff4df" height="7" rx="1" width="8" x="57" y="27" />
        </g>
      );
    }
    default: {
      return null;
    }
  }
}

/** Layered three-quarter silhouette with lit surfaces and a fixed ground shadow. */
export function PresenceSprite({
  accentColor = '#f1ba65',
  accessory = 'none',
  color,
  hairColor = '#302c39',
  hairStyle = 'swept',
  outfit = 'hoodie',
  skinColor = '#e9b48e',
  isDragging,
  reducedMotion,
  size = 84,
  status,
}: PresenceSpriteProps) {
  const id = useId().replaceAll(':', '');
  const fill = (part: string) => `url(#${id}-${part})`;
  const motionClass =
    reducedMotion || isDragging || status === 'offline' ? undefined : `presence-player-${status}`;
  return (
    <svg
      aria-hidden
      className="presence-character"
      focusable="false"
      height={size * 1.22}
      style={{
        opacity: status === 'offline' ? 0.55 : 1,
        filter: status === 'offline' ? 'grayscale(1)' : undefined,
      }}
      viewBox="0 0 100 122"
      width={size}
    >
      <defs>
        {(
          [
            ['skin', skinColor],
            ['shirt', color],
            ['hair', hairColor],
            ['accent', accentColor],
          ] as const
        ).map(([part, tone]) => (
          <linearGradient id={`${id}-${part}`} key={part} x1="0" x2="1" y1="0" y2="0.8">
            <stop stopColor={tone} />
            <stop offset="0.55" stopColor={tone} />
            <stop offset="1" stopColor="#26263c" />
          </linearGradient>
        ))}
        <radialGradient id={`${id}-shadow`}>
          <stop stopColor="#17223c" stopOpacity="0.35" />
          <stop offset="1" stopColor="#17223c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="51" cy="113" fill={fill('shadow')} rx="35" ry="8" />
      <g className={motionClass}>
        <path d="M35 88 L49 90 L47 107 L34 107Z M53 90 L67 87 L66 105 L54 106Z" fill="#353c54" />
        <path
          d="M33 101 Q40 104 47 102 L49 110 Q36 116 27 110 Q26 106 33 101Z M54 101 Q62 103 67 100 L73 106 Q68 113 54 110Z"
          fill="#f1ebdf"
        />
        <path
          d="M28 110 Q36 115 49 110 M54 110 Q66 113 73 107"
          fill="none"
          stroke="#a4aabd"
          strokeWidth="2"
        />
        <path
          d="M30 65 Q18 70 20 88 Q24 94 30 89 L37 73 M66 65 Q78 67 80 83 Q79 90 73 88 L62 74"
          fill={fill('shirt')}
        />
        <ellipse cx="25" cy="88" fill={fill('skin')} rx="6" ry="7" />
        <ellipse cx="76" cy="86" fill={fill('skin')} rx="5" ry="6" />
        <path d="M34 61 Q49 56 63 61 Q70 68 70 91 Q51 100 29 91 L30 72Z" fill={fill('shirt')} />
        <path d="M62 63 Q69 71 68 90 L61 93Z" fill="#242c48" opacity="0.14" />
        {outfit === 'hoodie' && (
          <g>
            <path d="M33 64 Q46 77 62 63 L58 60 L38 60Z" fill={fill('accent')} />
            <path
              d="M39 70 L39 79 M56 70 L56 78"
              stroke="#fff4df"
              strokeLinecap="round"
              strokeWidth="2"
            />
            <path d="M39 82 L58 82 L61 90 L36 90Z" fill="#242c48" opacity="0.18" />
          </g>
        )}
        {outfit === 'jacket' && (
          <g>
            <path d="M42 63 L54 63 L57 94 L42 95Z" fill="#f4ead8" />
            <path
              d="M36 62 L44 64 L40 78 L33 70 M58 62 L53 66 L60 78 L66 69"
              fill={fill('accent')}
            />
            <path d="M32 84 L39 84 M60 83 L66 82" stroke="#fff4df" strokeWidth="2" />
          </g>
        )}
        {outfit === 'overalls' && (
          <g fill="#3f5068">
            <path d="M36 65 L41 65 L42 78 L58 78 L59 64 L64 65 L63 94 Q46 99 34 92Z" />
            <rect fill={accentColor} height="9" rx="2" width="13" x="44" y="80" />
            <circle cx="39" cy="77" fill="#f4d48a" r="2" />
            <circle cx="61" cy="76" fill="#f4d48a" r="2" />
          </g>
        )}
        <path d="M42 53 L57 53 L58 63 Q51 69 42 62Z" fill={fill('skin')} />
        {hairStyle === 'bun' && <circle cx="29" cy="20" fill={fill('hair')} r="12" />}
        {hairStyle === 'bob' && <path d={HAIR_PATHS.bob} fill={fill('hair')} />}
        <ellipse cx="26" cy="45" fill={fill('skin')} rx="7" ry="9" />
        <path d="M28 29 Q39 16 60 24 Q74 29 71 46 Q70 60 54 64 Q34 65 29 52Z" fill={fill('skin')} />
        <path
          d="M33 32 Q42 25 55 27"
          fill="none"
          stroke="#fff5e6"
          strokeLinecap="round"
          strokeOpacity="0.28"
          strokeWidth="4"
        />
        <path d={HAIR_PATHS[hairStyle]} fill={fill('hair')} />
        <path
          d="M30 23 Q41 16 54 20"
          fill="none"
          stroke="white"
          strokeLinecap="round"
          strokeOpacity="0.12"
          strokeWidth="3"
        />
        <g fill="#302c39">
          {status === 'coding' ? (
            <>
              <ellipse cx="41" cy="44" rx="2.5" ry="3.5" />
              <ellipse cx="62" cy="43" rx="2.2" ry="3.2" />
              <circle cx="41.5" cy="43" fill="white" r="0.8" />
              <circle cx="62.5" cy="42" fill="white" r="0.7" />
            </>
          ) : (
            <path
              d="M38 45 Q41 47 44 44 M59 44 Q62 46 65 43"
              fill="none"
              stroke="#302c39"
              strokeLinecap="round"
              strokeWidth="2"
            />
          )}
        </g>
        <path
          d="M53 44 L55 50 L52 51"
          fill="none"
          stroke="#945e49"
          strokeLinecap="round"
          strokeOpacity="0.45"
          strokeWidth="1.5"
        />
        <path
          d="M47 55 Q52 58 57 54"
          fill="none"
          stroke="#754a45"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
        <ellipse cx="36" cy="51" fill="#e88986" opacity="0.35" rx="4" ry="2" />
        <CharacterAccessory accent={accentColor} accessory={accessory} />
      </g>
      {status !== 'offline' && (
        <g>
          <circle cx="85" cy="22" fill="#fff9e9" r="7" />
          <circle cx="85" cy="22" fill={status === 'coding' ? '#28b65a' : '#e1ad52'} r="4" />
        </g>
      )}
    </svg>
  );
}
