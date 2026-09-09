import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByRole('button', { name: 'AI' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
  it('labels Thai sample data and controls', () => {
    render(<HeroPanel locale="th" />);
    expect(screen.getByText('ข้อมูลจำลอง')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'คนเขียน' }));
    expect(screen.getByRole('status')).toHaveTextContent('คนเขียน 12AI 0ไม่ทราบ 0');
  });
});

describe('backend signup', () => {
  it('submits consent to the backend, preserves inputs and allows retry on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);
    render(<EarlyAccessForm locale="th" />);
    fireEvent.change(screen.getByLabelText('อีเมล'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(screen.getByRole('button', { name: 'ลงทะเบียน' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('เกิดข้อผิดพลาด');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/early-access',
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
