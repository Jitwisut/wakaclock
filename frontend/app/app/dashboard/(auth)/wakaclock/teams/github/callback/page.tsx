'use client';
import * as React from 'react';

import Link from 'next/link';

import { finishGithubAuthorization } from '@/lib/wakaclock/github-endpoints';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export default function GithubCallbackPage() {
  const userId = useWakaclockUserStore((s) => s.userId);
  const [status, setStatus] = React.useState(
    'Sign in with the AtoAxis account that started this connection.'
  );
  const request = React.useRef<{ code: string; state: string } | null>(null);
  const pending = React.useRef<{ promise: Promise<unknown>; user: string } | null>(null);
  React.useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (!request.current) {
      request.current = { state: query.get('state') ?? '', code: query.get('code') ?? '' };
    }
    window.history.replaceState(null, '', window.location.pathname);
  }, []);
  React.useEffect(() => {
    if (!userId || !request.current) return;
    const { state, code } = request.current;
    if (!state || !code) {
      setStatus('Authorization callback incomplete. Start the connection again.');
      return;
    }
    if (pending.current && pending.current.user !== userId) {
      setStatus('Account changed during authorization. Return to Teams and reconnect.');
      return;
    }
    // Strict Mode may remount effects: subscribe to the same single-use exchange.
    if (!pending.current) {
      pending.current = { user: userId, promise: finishGithubAuthorization(state, code) };
    }
    let active = true;
    pending.current.promise
      .then(() => {
        if (active) {
          setStatus('GitHub identity verified. Return to Teams to select repositories.');
        }
        return undefined;
      })
      .catch(() => {
        if (active) {
          setStatus('Authorization could not be verified. Return to Teams and reconnect.');
        }
      });
    return () => {
      active = false;
    };
  }, [userId]);
  return (
    <div className="space-y-3">
      <p role="status">{status}</p>
      <Link href="/dashboard/wakaclock/teams">Return to Teams</Link>
    </div>
  );
}
