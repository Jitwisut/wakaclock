'use client';

import * as React from 'react';

import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { approveOAuthDevice, normalizeDeviceCode } from '@/lib/wakaclock/oauth';

export function DeviceApprovalScreen() {
  const searchParams = useSearchParams();
  const [deviceCode, setDeviceCode] = React.useState(() =>
    normalizeDeviceCode(searchParams.get('code') ?? '')
  );
  const mutation = useMutation({
    mutationFn: approveOAuthDevice,
  });

  const normalizedCode = normalizeDeviceCode(deviceCode);
  const errorMessage = mutation.error instanceof Error ? mutation.error.message : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-6 py-12">
      <section className="border-border bg-card w-full border p-8 shadow-sm">
        <p className="text-muted-foreground text-sm font-medium">AtoAxis device authorization</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Approve this device</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          Enter the code shown by the AtoAxis integration. Approval grants only the scopes the
          integration requested; it does not reveal your password or API key.
        </p>

        {mutation.isSuccess ? (
          <div className="mt-6" role="status">
            <p className="font-medium">Device approved</p>
            <p className="text-muted-foreground mt-1 text-sm">
              You can return to the app that showed the code.
            </p>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (normalizedCode) mutation.mutate(normalizedCode);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="device-code">Device code</Label>
              <Input
                autoComplete="one-time-code"
                id="device-code"
                maxLength={32}
                onChange={(event) => setDeviceCode(event.target.value)}
                placeholder="ABCD-EFGH"
                spellCheck={false}
                value={deviceCode}
              />
            </div>
            {errorMessage ? (
              <p className="text-destructive text-sm" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <Button className="w-full" disabled={!normalizedCode || mutation.isPending} type="submit">
              {mutation.isPending ? 'Approving…' : 'Approve device'}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
