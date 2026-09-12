'use client';
import * as React from 'react';

import { v7 as uuidv7 } from 'uuid';

import { officeCommand, type OfficeMessage, officeMessages } from '@/lib/wakaclock/office';

export function OfficeChat({ roomId }: { roomId: string }) {
  const [messages, setMessages] = React.useState<OfficeMessage[]>([]);
  const [cursor, setCursor] = React.useState<null | string>(null);
  const [body, setBody] = React.useState('');
  const [error, setError] = React.useState<null | string>(null);
  const [busy, setBusy] = React.useState(false);
  const historyInitialized = React.useRef(false);
  const retry = React.useRef<{ body: string; id: string } | null>(null);
  React.useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    setMessages([]);
    historyInitialized.current = false;
    setCursor(null);
    setBody('');
    retry.current = null;
    const poll = async () => {
      try {
        if (!document.hidden) {
          const page = await officeMessages(roomId);
          if (!stopped) {
            setMessages((old) =>
              [...new Map([...old, ...page.items].map((m) => [m.id, m])).values()].sort((a, b) =>
                a.id.localeCompare(b.id)
              )
            );
            if (!historyInitialized.current) {
              setCursor(page.next_cursor);
              historyInitialized.current = true;
            }
            setError(null);
          }
        }
      } catch (error_) {
        if (!stopped) setError(error_ instanceof Error ? error_.message : 'Chat unavailable');
      }
      if (!stopped) timer = setTimeout(() => void poll(), 2000);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [roomId]);
  const older = async () => {
    if (!cursor) return;
    setBusy(true);
    try {
      const page = await officeMessages(roomId, cursor);
      setMessages((old) => [...new Map([...page.items, ...old].map((m) => [m.id, m])).values()]);
      setCursor(page.next_cursor);
    } catch (error_) {
      setError(String(error_));
    } finally {
      setBusy(false);
    }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    const message =
      retry.current?.body === body.trim() ? retry.current : { id: uuidv7(), body: body.trim() };
    retry.current = message;
    try {
      await officeCommand(roomId, { kind: 'message', ...message });
      setBody('');
      retry.current = null;
      const page = await officeMessages(roomId);
      setMessages((old) =>
        [...new Map([...old, ...page.items].map((m) => [m.id, m])).values()].sort((a, b) =>
          a.id.localeCompare(b.id)
        )
      );
      setError(null);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Message not sent. Retry.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Room chat" className="flex min-h-0 flex-col gap-3 p-3">
      {cursor && (
        <button
          className="presence-button"
          disabled={busy}
          onClick={() => void older()}
          type="button"
        >
          Load older messages
        </button>
      )}
      <ol aria-label="Messages" className="max-h-80 space-y-3 overflow-y-auto text-sm">
        {messages.map((m) => (
          <li key={m.id}>
            <div className="flex flex-wrap gap-2 text-xs">
              <strong>{m.username}</strong>
              <time dateTime={m.created_at}>
                {new Date(m.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
            <p className="break-words whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>
      {messages.length === 0 && !error && (
        <p className="text-sm">Start a conversation with your room.</p>
      )}
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      <form className="flex flex-col gap-2" onSubmit={(e) => void submit(e)}>
        <label className="text-xs" htmlFor="office-message">
          Message
        </label>
        <textarea
          className="presence-input min-h-20 w-full border p-2"
          id="office-message"
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
          value={body}
        />
        <button
          className="presence-button border p-2"
          disabled={busy || !body.trim()}
          type="submit"
        >
          {busy ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </section>
  );
}
