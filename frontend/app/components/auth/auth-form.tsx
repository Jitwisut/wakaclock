'use client';

import * as React from 'react';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAccount, registerAccount } from '@/lib/wakaclock/endpoints';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export type AuthMode = 'login' | 'register';

/**
 * The credential form itself, kept separate from the page it sits on so the login and
 * register routes differ only in copy and destination rather than in behaviour.
 *
 * The server derives `user_id` from a verified session, so username plus password is the
 * only way in — there is no "type any uuid" path to fall back to.
 */
export function AuthForm({ mode, onSuccess }: { mode: AuthMode; onSuccess: () => void }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const setSession = useWakaclockUserStore((state) => state.setSession);
  const errorId = React.useId();

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'login' ? loginAccount(username, password) : registerAccount(username, password),
    onSuccess: (res) => {
      setSession({
        userId: res.data.user_id,
        username: res.data.username,
        token: res.data.token,
      });
      toast.success(mode === 'login' ? 'Logged in' : 'Account created');
      onSuccess();
    },
  });

  const failed = mutation.isError;

  return (
    <form
      className="space-y-5"
      noValidate={false}
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-2">
        <Label className="text-xs tracking-[0.14em] uppercase" htmlFor={`${mode}-username`}>
          Username
        </Label>
        <Input
          aria-describedby={failed ? errorId : undefined}
          aria-invalid={failed || undefined}
          autoCapitalize="none"
          autoComplete="username"
          className="h-11"
          id={`${mode}-username`}
          name="username"
          onChange={(event) => setUsername(event.target.value)}
          required
          spellCheck={false}
          value={username}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs tracking-[0.14em] uppercase" htmlFor={`${mode}-password`}>
          Password
        </Label>
        <Input
          aria-describedby={mode === 'register' ? `${mode}-password-hint` : undefined}
          aria-invalid={failed || undefined}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className="h-11"
          id={`${mode}-password`}
          minLength={mode === 'register' ? 8 : undefined}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        {mode === 'register' ? (
          <p className="text-muted-foreground text-xs" id={`${mode}-password-hint`}>
            At least 8 characters. No email address and no payment details are asked for.
          </p>
        ) : null}
      </div>

      {/*
        The only place the failure is reported. A toast would land in a corner, disappear
        on a timer and — because this is also a live region — be announced twice, which is
        the wrong treatment for the one message explaining why the form did not go through.
      */}
      <p aria-live="polite" className="text-destructive min-h-5 text-sm" id={errorId} role="status">
        {failed ? (mutation.error as Error).message : null}
      </p>

      <Button
        className="h-11 w-full text-sm tracking-[0.08em] uppercase"
        disabled={mutation.isPending}
        type="submit"
      >
        {submitLabel(mode, mutation.isPending)}
      </Button>
    </form>
  );
}

function submitLabel(mode: AuthMode, isPending: boolean) {
  if (isPending) return mode === 'login' ? 'Signing in…' : 'Creating account…';

  return mode === 'login' ? 'Sign in' : 'Create account';
}
