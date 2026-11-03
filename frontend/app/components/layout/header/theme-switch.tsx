'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface ThemeSwitchLabels {
  dark?: string;
  light?: string;
  system?: string;
  toggleTheme?: string;
}

export interface ThemeSwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  labels?: ThemeSwitchLabels;
  testId?: string;
}

type Appearance = 'dark' | 'light' | 'system';

function isAppearance(value: string | undefined): value is Appearance {
  return value === 'dark' || value === 'light' || value === 'system';
}

/**
 * Appearance menu: Light, Dark or follow the operating system. next-themes stores the
 * choice and applies the class before paint, so switching never flashes. The trigger
 * shows the appearance currently in effect (the resolved one when following the system).
 */
const ThemeSwitch = React.forwardRef<HTMLButtonElement, ThemeSwitchProps>(
  ({ labels, testId = 'header-theme-switch', ...props }, ref) => {
    const [mounted, setMounted] = useState(false);
    const { resolvedTheme, setTheme, theme } = useTheme();
    const label = labels?.toggleTheme ?? 'Appearance';

    useEffect(() => {
      setMounted(true);
    }, []);

    if (!mounted) {
      return null;
    }

    const current: Appearance = isAppearance(theme) ? theme : 'system';
    const TriggerIcon = resolvedTheme === 'dark' ? MoonIcon : SunIcon;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`${label}: ${current}`}
            className="relative"
            data-slot="theme-switch"
            data-testid={testId}
            ref={ref}
            size="icon"
            type="button"
            variant="ghost"
            {...props}
          >
            <TriggerIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuLabel className="text-muted-foreground text-xs">{label}</DropdownMenuLabel>
          <DropdownMenuRadioGroup onValueChange={(value) => setTheme(value)} value={current}>
            <DropdownMenuRadioItem data-testid={`${testId}-light`} value="light">
              <SunIcon aria-hidden className="size-4" />
              {labels?.light ?? 'Light'}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem data-testid={`${testId}-dark`} value="dark">
              <MoonIcon aria-hidden className="size-4" />
              {labels?.dark ?? 'Dark'}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem data-testid={`${testId}-system`} value="system">
              <MonitorIcon aria-hidden className="size-4" />
              {labels?.system ?? 'System'}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);

ThemeSwitch.displayName = 'ThemeSwitch';

export { ThemeSwitch };
export default ThemeSwitch;
