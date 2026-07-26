'use client';

import * as React from 'react';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { loginAccount, registerAccount } from '@/lib/wakaclock/endpoints';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

/**
 * Renders wherever a page needs an identified session — see RequireUser. Replaces the
 * earlier "type any uuid" model: the backend now derives `user_id` from a verified
 * session JWT, so this is the only way in.
 */
export function AuthPanel() {
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Wakaclock</CardTitle>
        <CardDescription>Log in or create an account to see your coding data.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login">
          <TabsList className="w-full">
            <TabsTrigger className="flex-1" value="login">
              Log in
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="register">
              Register
            </TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <AuthForm mode="login" />
          </TabsContent>
          <TabsContent value="register">
            <AuthForm mode="register" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const setSession = useWakaclockUserStore((s) => s.setSession);

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
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <form
      className="space-y-3 pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${mode}-username`}>Username</Label>
        <Input
          autoComplete="username"
          id={`${mode}-username`}
          onChange={(e) => setUsername(e.target.value)}
          value={username}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${mode}-password`}>Password</Label>
        <Input
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          id={`${mode}-password`}
          minLength={mode === 'register' ? 8 : undefined}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          value={password}
        />
        {mode === 'register' && (
          <p className="text-muted-foreground text-xs">At least 8 characters.</p>
        )}
      </div>
      <CardFooter className="px-0 pt-1">
        <Button
          className="w-full"
          disabled={!username || !password || mutation.isPending}
          type="submit"
        >
          {submitLabel(mode, mutation.isPending)}
        </Button>
      </CardFooter>
    </form>
  );
}

function submitLabel(mode: 'login' | 'register', isPending: boolean) {
  if (isPending) return 'Please wait…';
  return mode === 'login' ? 'Log in' : 'Create account';
}
