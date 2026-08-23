import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthScreen } from '@/components/auth/auth-screen';
import { WakaclockUserProvider } from '@/lib/wakaclock/user-store';

const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: '' }));
const login = vi.hoisted(() => vi.fn());
const register = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search.value),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/wakaclock/endpoints', () => ({
  loginAccount: (...args: unknown[]) => login(...args),
  registerAccount: (...args: unknown[]) => register(...args),
}));

function renderScreen(mode: 'login' | 'register' = 'login') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <WakaclockUserProvider>
        <AuthScreen mode={mode} />
      </WakaclockUserProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  search.value = '';
  window.localStorage.clear();
  login.mockReset();
  register.mockReset();
  replace.mockReset();
});

describe('AuthScreen', () => {
  it('renders the sign-in form without any dashboard chrome', () => {
    renderScreen('login');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pick the log');
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
  });

  it('sends the visitor to their original destination after signing in', async () => {
    search.value = 'next=%2Fdashboard%2Fwakaclock%2Fai';
    login.mockResolvedValue({
      data: { user_id: 'u-1', username: 'demo', token: 't-1' },
    });

    renderScreen('login');

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'demo' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/wakaclock/ai'));
    expect(login).toHaveBeenCalledWith('demo', 'hunter2hunter2');
  });

  // Each of these is a way of writing an off-site destination that still begins with a
  // slash. `/\\host` matters because URL parsing normalises the backslash for http(s),
  // making it protocol-relative.
  it.each([
    ['absolute url', 'https%3A%2F%2Fevil.example.com'],
    ['protocol relative', '%2F%2Fevil.example.com'],
    ['backslash escape', '%2F%5Cevil.example.com'],
    ['double backslash', '%5C%5Cevil.example.com'],
    ['leading whitespace', '%09%2Fdashboard%2Fwakaclock%2Fai'],
    ['scheme only', 'javascript%3Aalert(1)'],
  ])('refuses an off-site ?next= (%s) instead of redirecting to it', async (_label, next) => {
    search.value = `next=${next}`;
    login.mockResolvedValue({ data: { user_id: 'u-1', username: 'demo', token: 't-1' } });

    renderScreen('login');

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'demo' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/wakaclock'));
  });

  it('shows why a failed sign-in failed, in the form rather than only a toast', async () => {
    login.mockRejectedValue(new Error('Invalid username or password'));

    renderScreen('login');

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'demo' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid username or password')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true');
    expect(replace).not.toHaveBeenCalled();
  });

  it('registers with the register endpoint and keeps ?next= on the switch link', () => {
    search.value = 'next=%2Fdashboard%2Fwakaclock%2Fai';

    renderScreen('register');

    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?next=%2Fdashboard%2Fwakaclock%2Fai'
    );
    expect(screen.getByText(/At least 8 characters/)).toBeInTheDocument();
  });

  it('bounces a visitor who is already signed in', async () => {
    window.localStorage.setItem(
      'wakaclock-session',
      JSON.stringify({ userId: 'u-1', username: 'demo', token: 't-1' })
    );

    renderScreen('login');

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/wakaclock'));
  });
});
