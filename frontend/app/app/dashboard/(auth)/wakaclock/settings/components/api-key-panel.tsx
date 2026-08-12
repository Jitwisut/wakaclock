'use client';

import * as React from 'react';

import { useMutation } from '@tanstack/react-query';
import { CheckIcon, CopyIcon, KeyRoundIcon, TriangleAlertIcon } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { generateApiKey, revokeApiKey } from '@/lib/wakaclock/endpoints';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export function ApiKeyPanel() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [plaintextKey, setPlaintextKey] = React.useState<null | string>(null);
  const [copied, setCopied] = React.useState(false);

  const generateMutation = useMutation({
    mutationFn: generateApiKey,
    onSuccess: (res) => {
      setPlaintextKey(res.data.api_key);
      setCopied(false);
      toast.success('New API key generated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      setPlaintextKey(null);
      toast.success('API key revoked');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function copyKey() {
    if (!plaintextKey) return;
    await navigator.clipboard.writeText(plaintextKey);
    setCopied(true);
    toast.success('Copied to clipboard');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRoundIcon className="size-4" />
          API key
        </CardTitle>
        <CardDescription>
          POST/DELETE /users/current/api_key — lets a CLI or editor extension authenticate as you.
          Only generates a key for the account you&apos;re currently logged into as this session —
          proven by your login, not a query param anyone could set.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {plaintextKey ? (
          <div className="space-y-2">
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>Copy this now — it won&apos;t be shown again</AlertTitle>
              <AlertDescription>
                Only its hash is stored. If you lose it, generate a new one (this invalidates the
                old key everywhere it&apos;s used).
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Input className="font-mono text-xs" readOnly value={plaintextKey} />
              <Button aria-label="Copy API key" onClick={copyKey} size="icon" variant="outline">
                {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Run <code className="text-foreground">wakaclock-cli config set-key &lt;KEY&gt;</code>{' '}
              in a terminal, or use &quot;Wakaclock: Set API Key&quot; in VS Code, to start
              authenticating with it.
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No key shown — generating one below always creates a brand new key (the old one, if any,
            stops working immediately).
          </p>
        )}

        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!userId || generateMutation.isPending}>
                {plaintextKey || generateMutation.isPending ? 'Regenerate key' : 'Generate key'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Generate a new API key?</AlertDialogTitle>
                <AlertDialogDescription>
                  Any key currently in use by a CLI or extension for this user_id will stop working
                  immediately and need to be replaced.
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
              <Button disabled={!userId || revokeMutation.isPending} variant="destructive">
                Revoke key
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke the current key?</AlertDialogTitle>
                <AlertDialogDescription>
                  Requests using it will immediately fall back to trusting whatever user_id they
                  claim themselves, the same as before any key existed.
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
        </div>
      </CardContent>
    </Card>
  );
}
