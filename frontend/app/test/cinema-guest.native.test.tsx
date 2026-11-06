import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ForgotPasswordPage from '@/app/dashboard/(guest)/forgot-password/page';
import NotFoundPage, {
  generateMetadata as notFoundMetadata,
} from '@/app/dashboard/(guest)/pages/error/404/page';
import ServerErrorPage, {
  generateMetadata as serverErrorMetadata,
} from '@/app/dashboard/(guest)/pages/error/500/page';
import { CinemaAuthStage, SAMPLE_DAY } from '@/components/auth/cinema-auth-stage';

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const scene = vi.hoisted(() => ({ rendered: 0 }));
vi.mock('next/dynamic', () => ({
  default: () =>
    function SceneStub() {
      scene.rendered += 1;
      return <div data-testid="scene-stub" />;
    },
}));

describe('CinemaAuthStage', () => {
  it('labels its dial as an illustrative sample and never reads data', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<CinemaAuthStage mode="login" />);
    expect(screen.getByRole('complementary', { name: 'AtoAxis' })).toBeInTheDocument();
    expect(screen.getByText('Illustrative sample day · not your data')).toBeInTheDocument();
    expect(screen.getByText('Scene 00 · Welcome back')).toBeInTheDocument();
    expect(screen.getByTestId('time-core-dial')).toBeInTheDocument();
    expect(screen.getByText('Never collected')).toBeInTheDocument();
  });

  it('turns the 3D dial where WebGL exists, with first-day copy on register', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
    render(<CinemaAuthStage mode="register" />);
    expect(screen.getByTestId('scene-stub')).toBeInTheDocument();
    expect(screen.getByText('Scene 00 · First day')).toBeInTheDocument();
  });

  it('draws a fixed sample of three projects', () => {
    expect(SAMPLE_DAY.rings.map((ring) => ring.label).sort()).toEqual(['api', 'docs', 'web']);
    expect(SAMPLE_DAY.totalSeconds).toBe((70 + 95 + 45 + 80 + 35 + 50) * 60);
  });
});

describe('Cinema guest pages', () => {
  it('frames the 404 with a way back to the dashboard and home', () => {
    render(<NotFoundPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Page Not Found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the dashboard' })).toHaveAttribute(
      'href',
      '/dashboard/wakaclock'
    );
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
  });

  it('frames the 500 the same way', () => {
    render(<ServerErrorPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Server Error' })).toBeInTheDocument();
    expect(screen.getByText('Something failed on our side, not yours.')).toBeInTheDocument();
  });

  it('keeps the reset form inside the frame', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Forgot Password' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Reset Instructions' })).toBeInTheDocument();
  });

  it('describes both error pages in metadata', async () => {
    expect((await notFoundMetadata()).title).toBeTruthy();
    expect((await serverErrorMetadata()).title).toBeTruthy();
  });

  it('runs the reset form as before: validation, then its acknowledgement', async () => {
    render(<ForgotPasswordPage />);
    const submit = screen.getByRole('button', { name: 'Send Reset Instructions' });
    await act(async () => {
      fireEvent.click(submit);
    });
    expect(await screen.findByText('Please enter a valid email address')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Enter your email addresss'), {
      target: { value: 'dev@example.com' },
    });
    await act(async () => {
      fireEvent.click(submit);
    });
    expect(await screen.findByText('Please wait')).toBeInTheDocument();
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith('Request submitted!'), {
      timeout: 3000,
    });
  });
});
