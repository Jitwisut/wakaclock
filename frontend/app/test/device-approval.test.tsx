import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeviceApprovalScreen } from '@/app/(account)/device/components/device-approval-screen';
import { normalizeDeviceCode } from '@/lib/wakaclock/oauth';

const approve = vi.hoisted(() => vi.fn());
const query = vi.hoisted(() => ({ value: 'code=abcd-efgh' }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(query.value),
}));

vi.mock('@/lib/wakaclock/oauth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/wakaclock/oauth')>();
  return {
    ...original,
    approveOAuthDevice: (code: string) => approve(code),
  };
});

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DeviceApprovalScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  approve.mockReset();
  query.value = 'code=abcd-efgh';
});

describe('device approval', () => {
  it('normalizes codes without changing the hyphen contract', () => {
    expect(normalizeDeviceCode('  abcd-efgh  ')).toBe('ABCD-EFGH');
    expect(normalizeDeviceCode('abcd efgh')).toBe('ABCD-EFGH');
    expect(normalizeDeviceCode('abcdefgh')).toBe('ABCD-EFGH');
  });

  it('pre-fills the code, approves it, and renders completion state', async () => {
    approve.mockResolvedValue(undefined);
    renderScreen();

    expect(screen.getByLabelText('Device code')).toHaveValue('ABCD-EFGH');
    fireEvent.click(screen.getByRole('button', { name: 'Approve device' }));

    await waitFor(() => expect(approve).toHaveBeenCalledWith('ABCD-EFGH'));
    expect(await screen.findByRole('status')).toHaveTextContent('Device approved');
  });

  it('surfaces an approval error without claiming success', async () => {
    approve.mockRejectedValue(new Error('device code is invalid or expired'));
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Approve device' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('device code is invalid or expired');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
