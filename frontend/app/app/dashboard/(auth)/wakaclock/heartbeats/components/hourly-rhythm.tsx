'use client';

import { motion } from 'motion/react';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function HourlyRhythm({
  hourly,
  onSelect,
  selected,
}: {
  hourly: number[];
  onSelect: (hour: null | number) => void;
  selected: null | number;
}) {
  const reduced = useReducedMotion();
  const max = Math.max(1, ...hourly);
  const peak = hourly.indexOf(Math.max(...hourly));
  const activeHours = hourly.filter((count) => count > 0).length;

  return (
    <section className="bg-card text-card-foreground flex min-w-0 flex-col gap-5 rounded-2xl border p-5 shadow-xs sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Daily rhythm</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Heartbeats per hour · {activeHours} hour{activeHours === 1 ? '' : 's'} with activity ·
            select an hour to filter the stream
          </p>
        </div>
        {selected !== null && (
          <button
            className="text-muted-foreground hover:text-foreground cursor-pointer rounded-md text-xs underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => onSelect(null)}
            type="button"
          >
            Clear hour
          </button>
        )}
      </header>

      <div className="grid h-40 grid-cols-24 items-end gap-[3px] sm:gap-1.5">
        {HOURS.map((hour) => {
          const count = hourly[hour] ?? 0;
          const isSelected = selected === hour;
          const dimmed = selected !== null && !isSelected;
          const height = count === 0 ? 0 : Math.max(0.06, count / max);
          return (
            <button
              aria-label={`${hourLabel(hour)}: ${count} heartbeat${count === 1 ? '' : 's'}`}
              aria-pressed={isSelected}
              className="group relative flex h-full cursor-pointer items-end rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              disabled={count === 0 && !isSelected}
              key={hour}
              onClick={() => onSelect(isSelected ? null : hour)}
              type="button"
            >
              <span className="bg-muted/60 absolute inset-x-0 bottom-0 h-full rounded-md opacity-0 transition-opacity group-hover:opacity-100" />
              <motion.span
                animate={{ scaleY: height }}
                className={cn(
                  'relative block h-full w-full origin-bottom rounded-[5px] transition-[opacity,filter] duration-200',
                  hour === peak && count > 0
                    ? 'bg-gradient-to-t from-emerald-500 to-teal-300 dark:from-emerald-500 dark:to-emerald-200'
                    : 'bg-gradient-to-t from-slate-400 to-slate-300 dark:from-slate-600 dark:to-slate-400',
                  isSelected && 'from-violet-600 to-fuchsia-400 dark:from-violet-500 dark:to-fuchsia-300',
                  dimmed && 'opacity-35',
                  'group-hover:brightness-110'
                )}
                initial={reduced ? false : { scaleY: 0 }}
                transition={{
                  delay: reduced ? 0 : hour * 0.025,
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
              {count > 0 && (
                <span className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-md border px-2 py-1 text-[11px] whitespace-nowrap shadow-md group-hover:block group-focus-visible:block">
                  <span className="font-mono tabular-nums">{hourLabel(hour)}</span> · {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className="text-muted-foreground -mt-3 grid grid-cols-24 gap-[3px] font-mono text-[10px] sm:gap-1.5"
      >
        {HOURS.map((hour) => (
          <span className="text-center" key={hour}>
            {hour % 6 === 0 ? String(hour).padStart(2, '0') : ''}
          </span>
        ))}
      </div>
    </section>
  );
}
