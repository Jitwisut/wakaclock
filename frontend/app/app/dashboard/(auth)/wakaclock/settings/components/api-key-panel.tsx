'use client';

import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { generateApiKey, getCurrentApiKey, revokeApiKey } from '@/lib/wakaclock/endpoints';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export function ApiKeyPanel() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [plaintextKey, setPlaintextKey] = React.useState<null | string>(null);
  const [copied, setCopied] = React.useState(false);

  // The stored key, so it can be shown whenever it's needed. It has to be pasted into
  // config.toml, the editor extension and any agent hook, and losing it between those
  // steps used to mean regenerating — which kills the copy already in use.
  const currentKeyQuery = useQuery({
    queryKey: ['wakaclock', 'api-key', userId],
    queryFn: getCurrentApiKey,
    enabled: Boolean(userId),
  });

  // A key just generated in this session wins: it is the freshest value, and it is
  // available before the query refetches.
  const shownKey = plaintextKey ?? currentKeyQuery.data?.data.api_key ?? null;

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
      setPlaintextKey(key);
      setCopied(false);
      void queryClient.invalidateQueries({ queryKey: ['wakaclock', 'api-key'] });
      toast.success('New API key generated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      setPlaintextKey(null);
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRoundIcon className="size-4" />
          API key
        </CardTitle>
        <CardDescription>
          Lets a CLI, editor extension or agent hook authenticate as you. Always tied to the
          account this session is logged into — proven by your login, not a query param anyone
          could set.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {shownKey ? (
          <div className="space-y-2">
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>Treat this like a password</AlertTitle>
              <AlertDescription>
                Anyone with this key can send and read coding activity as you. It stays visible
                here, so there is no need to regenerate just to look it up — regenerating breaks
                every place the old key is already in use.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Input className="font-mono text-xs" readOnly value={shownKey} />
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
            {currentKeyQuery.isLoading
              ? 'Loading your API key…'
              : 'No key yet — generate one below. If you had a key from before keys were stored, it still works but can no longer be displayed; generate a new one to see it here.'}
          </p>
        )}

        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!userId || generateMutation.isPending}>
                {shownKey || generateMutation.isPending ? 'Regenerate key' : 'Generate key'}
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
