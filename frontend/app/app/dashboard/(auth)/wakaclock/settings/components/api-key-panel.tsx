'use client';

import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  SparklesIcon,
  TerminalIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';
import { generateApiKey, getCurrentApiKey, revokeApiKey } from '@/lib/wakaclock/endpoints';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from '../settings.module.css';

import { Surface, SurfaceHeader } from './surface';

// The CLI binary is `wakaclock`. `set-key --stdin` reads until end of input, so piping
// the clipboard keeps the key out of shell history and process listings (the positional
// form is deprecated).
const CLI_COMMAND = 'pbpaste | wakaclock config set-key --stdin';

function SwapIcon({ on }: { on: boolean }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, rotate: 45, scale: 0.5 }}
        initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: -45, scale: 0.5 }}
        key={on ? 'check' : 'copy'}
        transition={{ duration: 0.2 }}
      >
        {on ? (
          <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <CopyIcon className="size-4" />
        )}
      </motion.span>
    </AnimatePresence>
  );
}

const SETUP_TABS = [
  { id: 'cli', label: 'CLI' },
  { id: 'vscode', label: 'VS Code' },
] as const;

function QuickSetup() {
  const reduced = useReducedMotion();
  const [tab, setTab] = React.useState<(typeof SETUP_TABS)[number]['id']>('cli');
  const [copied, setCopied] = React.useState(false);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(CLI_COMMAND);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  }

  return (
    <div className="border-t px-5 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">Quick setup</h4>
          <p className="text-muted-foreground mt-0.5 text-xs">Paste your key into one client.</p>
        </div>
        <div aria-label="Client" className="bg-muted flex rounded-full p-0.5" role="tablist">
          {SETUP_TABS.map((t) => (
            <button
              aria-selected={tab === t.id}
              className={cn(
                'focus-visible:ring-ring relative cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                tab === t.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              key={t.id}
              onClick={() => setTab(t.id)}
              role="tab"
              type="button"
            >
              {tab === t.id && (
                <motion.span
                  className="bg-background absolute inset-0 rounded-full shadow-sm"
                  layoutId="api-key-setup-tab"
                  transition={reduced ? { duration: 0 } : { bounce: 0.2, type: 'spring' }}
                />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence initial={false} mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          initial={reduced ? false : { opacity: 0, y: 6 }}
          key={tab}
          role="tabpanel"
          transition={{ duration: 0.2 }}
        >
          {tab === 'cli' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl bg-[oklch(0.18_0.012_255)] p-1.5 pl-3.5 text-[oklch(0.92_0.01_250)] shadow-inner">
                <TerminalIcon aria-hidden="true" className="size-4 shrink-0 text-emerald-400" />
                <code className="no-scrollbar min-w-0 flex-1 overflow-x-auto py-2 font-mono text-[13px] whitespace-nowrap">
                  {CLI_COMMAND}
                </code>
                <Button
                  aria-label="Copy CLI command"
                  className="shrink-0 rounded-lg bg-white/10 text-white hover:bg-white/20"
                  onClick={copyCommand}
                  size="icon"
                  variant="ghost"
                >
                  <SwapIcon on={copied} />
                </Button>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Copy your key first: on macOS <code className="text-foreground">pbpaste</code> pipes
                it from the clipboard, so it never lands in your shell history. Elsewhere run{' '}
                <code className="text-foreground">wakaclock config set-key --stdin</code>, paste the
                key, then press Ctrl+D.
              </p>
            </div>
          ) : (
            <ol className="grid gap-2 sm:grid-cols-3">
              {[
                ['Open the Command Palette', '⌘⇧P on macOS, Ctrl+Shift+P elsewhere'],
                ['Run “Wakaclock: Set API Key”', 'Start typing “API key” to find it'],
                ['Paste your key', 'The extension stores it for you'],
              ].map(([title, detail], index) => (
                <li className="bg-muted/40 flex gap-3 rounded-xl border p-3" key={title}>
                  <span className="bg-foreground text-background grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px]">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="text-muted-foreground block text-xs">{detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function ApiKeyPanel() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [plaintextKey, setPlaintextKey] = React.useState<{ userId: string; value: string } | null>(
    null
  );
  const [copied, setCopied] = React.useState(false);
  // Always start hidden so opening the page in front of someone never puts the
  // key on screen. Revealing is a deliberate click.
  const [revealed, setRevealed] = React.useState(false);

  // The server returns the key here when it holds a sealed copy (ATOAXIS_KMS_KEY_ID
  // set); otherwise this stays null and the key is shown only once at creation.
  const currentKeyQuery = useQuery({
    queryKey: ['wakaclock', 'api-key', userId],
    queryFn: getCurrentApiKey,
    enabled: Boolean(userId),
  });

  const storedKey =
    currentKeyQuery.data?.data?.user_id === userId
      ? (currentKeyQuery.data?.data?.api_key ?? null)
      : null;
  // Prefer the freshly generated value until the follow-up query catches up.
  const freshKey = plaintextKey?.userId === userId ? plaintextKey.value : null;
  const shownKey = freshKey ?? storedKey;
  const justGenerated = Boolean(freshKey);

  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: generateApiKey,
    onSuccess: (res) => {
      // Generating always replaces the old key server-side, so reporting success
      // without showing the new one would leave the account with a key nobody has.
      // Treat a missing key as the failure it is rather than a silent success.
      const key = res?.data?.api_key;
      if (!key) {
        toast.error(
          'The server did not return a key. Your previous key has stopped working — generate again.'
        );
        return;
      }
      setPlaintextKey({ userId: res.data.user_id, value: key });
      setCopied(false);
      setRevealed(false);
      void queryClient.invalidateQueries({ queryKey: ['wakaclock', 'api-key'] });
      toast.success('New API key generated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      setPlaintextKey(null);
      setRevealed(false);
      queryClient.setQueryData(['wakaclock', 'api-key', userId], {
        data: { api_key: null, user_id: userId },
      });
      void queryClient.invalidateQueries({ queryKey: ['wakaclock', 'api-key'] });
      toast.success('API key revoked');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function copyKey() {
    if (!shownKey) return;
    await navigator.clipboard.writeText(shownKey);
    setCopied(true);
    toast.success('Copied to clipboard');
  }

  return (
    <Surface>
      <SurfaceHeader
        actions={
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="gap-1.5 rounded-full"
                  disabled={!userId || generateMutation.isPending}
                >
                  <SparklesIcon className="size-3.5" />
                  {shownKey || generateMutation.isPending ? 'Regenerate key' : 'Generate key'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Generate a new API key?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Any key currently in use by a CLI or extension for this user_id will stop
                    working immediately and need to be replaced.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => generateMutation.mutate()}>
                    Generate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="text-destructive hover:text-destructive rounded-full"
                  disabled={!userId || revokeMutation.isPending}
                  variant="outline"
                >
                  Revoke key
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke the current key?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Requests using it will immediately receive an authentication error until a new
                    key is generated.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => revokeMutation.mutate()}>
                    Revoke
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
        description="Proven by your login, not a query param anyone could set."
        icon={KeyRoundIcon}
        title="Your key"
      />

      <div className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
        <AnimatePresence initial={false}>
          {justGenerated && (
            <motion.div
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <Alert className="border-amber-500/40 bg-amber-500/8">
                <TriangleAlertIcon className="text-amber-600 dark:text-amber-400" />
                <AlertTitle>Treat this like a password</AlertTitle>
                <AlertDescription>
                  Anyone with this key can send and read coding activity as you. Copy it now and
                  store it somewhere safe.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {shownKey ? (
          <div className="space-y-2">
            <div
              className={cn(
                styles.keySlot,
                revealed && styles.keySlotRevealed,
                'bg-muted/50 flex items-center gap-2 rounded-xl border p-1.5 pl-3'
              )}
            >
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <Input
                aria-label="API key"
                className="h-10 border-0 bg-transparent font-mono text-sm tracking-wide shadow-none focus-visible:ring-0 dark:bg-transparent"
                readOnly
                type={revealed ? 'text' : 'password'}
                value={shownKey}
              />
              <Button
                aria-label={revealed ? 'Hide API key' : 'Reveal API key'}
                aria-pressed={revealed}
                className="shrink-0 rounded-lg"
                onClick={() => setRevealed((v) => !v)}
                size="icon"
                variant="ghost"
              >
                {revealed ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </Button>
              <Button
                aria-label="Copy API key"
                className="shrink-0 rounded-lg"
                onClick={copyKey}
                size="icon"
                variant="secondary"
              >
                <SwapIcon on={copied} />
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Hidden by default so it is not exposed on screen. Reveal it or copy it straight to the
              clipboard.
            </p>
          </div>
        ) : (
          <div className="bg-muted/30 flex items-center gap-4 rounded-xl border border-dashed p-5">
            <span className="bg-background grid size-11 shrink-0 place-items-center rounded-xl border shadow-sm">
              <KeyRoundIcon className="text-muted-foreground size-5" />
            </span>
            <p className="text-muted-foreground text-sm">
              {currentKeyQuery.isLoading
                ? 'Loading your API key…'
                : 'No API key yet. Generate one to connect your tools.'}
            </p>
          </div>
        )}
      </div>

      <QuickSetup />
    </Surface>
  );
}
