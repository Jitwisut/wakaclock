import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EarlyAccessForm } from '@/components/marketing/early-access-form';
import { HeroPanel } from '@/components/marketing/hero-panel';

vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_WAKACLOCK_API_URL: 'http://localhost:8080' } }));
afterEach(() => vi.unstubAllGlobals());

describe('activity studio', () => {
  it('keeps 12 lines across modes and exposes unknown attribution', () => {
    render(<HeroPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('Human 5AI 5Unknown 2');
    fireEvent.click(screen.getByRole('button', { name: 'Unknown' }));
    expect(screen.getByRole('status')).toHaveTextContent('Human 0AI 0Unknown 12');
    fireEvent.click(screen.getByRole('button', { name: 'AI' }));
    expect(screen.getByRole('status')).toHaveTextContent('Human 0AI 12Unknown 0');
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
    expect(screen.getByRole('button', { name: 'AI' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('labels Thai sample data and controls', () => {
    render(<HeroPanel locale="th" />);
    expect(screen.getByText('ข้อมูลจำลอง')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'คนเขียน' }));
    expect(screen.getByRole('status')).toHaveTextContent('คนเขียน 12AI 0ไม่ทราบ 0');
  });
});

describe('backend signup', () => {
  it('navigates after the backend explicitly confirms persistence and prevents resubmission during navigation', async () => {
    const navigate = vi.fn();
    const actualWindow = window;
    vi.stubGlobal(
      'window',
      new Proxy(actualWindow, {
        get(target, property) {
          return property === 'location'
            ? { assign: navigate }
            : Reflect.get(target, property, target);
        },
      })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) })
    );
    render(<EarlyAccessForm />);
    fireEvent.submit(screen.getByRole('button', { name: 'Join the list' }).closest('form')!);
    await act(async () => {});
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/early-access/success');
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('uses the solo default when the optional interest control is not submitted', async () => {
    const request = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', request);
    render(<EarlyAccessForm />);
    (screen.getByLabelText('What are you interested in?') as HTMLSelectElement).disabled = true;
    fireEvent.submit(screen.getByRole('button', { name: 'Join the list' }).closest('form')!);
    await screen.findByRole('alert');
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ interest: 'solo' });
  });
  it.each([null, 'accepted', { accepted: false }, { accepted: 'true' }])(
    'requires an explicit persistence acknowledgement, received %j',
    async (result) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => result }));
      render(<EarlyAccessForm />);
      fireEvent.submit(screen.getByRole('button', { name: 'Join the list' }).closest('form')!);
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
      expect(screen.getByRole('button', { name: 'Join the list' })).toBeEnabled();
    }
  );

  it('submits only once while pending and allows retry after a network failure', async () => {
    let reject!: (reason: Error) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((_resolve, fail) => {
        reject = fail;
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<EarlyAccessForm />);
    const form = screen.getByRole('button', { name: 'Join the list' }).closest('form')!;
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    await act(async () => reject(new Error('offline')));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveValue('test@example.com');
    fetchMock.mockResolvedValue({ ok: false });
    fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('submits consent to the backend, preserves inputs and allows retry on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);
    render(<EarlyAccessForm locale="th" />);
    fireEvent.change(screen.getByLabelText('อีเมล'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(screen.getByRole('button', { name: 'ลงทะเบียน' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('เกิดข้อผิดพลาด');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/early-access',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          interest: 'solo',
          locale: 'th',
          source_page: 'early-access',
          consent: true,
          bot_field: '',
        }),
      })
    );
    expect(screen.getByLabelText('อีเมล')).toHaveValue('test@example.com');
    expect(screen.getByRole('button', { name: 'ลงทะเบียน' })).toBeEnabled();
  });
  it('does not accept a generic 200 response without a persistence acknowledgement', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    render(<EarlyAccessForm />);
    fireEvent.submit(screen.getByRole('button', { name: 'Join the list' }).closest('form')!);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
