import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ForgotPasswordPage from '@/app/dashboard/(guest)/forgot-password/page';
import NotFoundPage from '@/app/dashboard/(guest)/pages/error/404/page';
import ServerErrorPage from '@/app/dashboard/(guest)/pages/error/500/page';

describe('Guest pages (classic presets)', () => {
  it('keep their original markup', () => {
    render(<NotFoundPage />);
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to the dashboard' })).not.toBeInTheDocument();
  });

  it('keep the original 500 and reset pages', () => {
    render(<ServerErrorPage />);
    expect(screen.getByText('Server Error')).toBeInTheDocument();
    render(<ForgotPasswordPage />);
    expect(screen.getByText('Forgot Password')).toBeInTheDocument();
    expect(screen.queryByText('Reset access to your history.')).not.toBeInTheDocument();
  });
});
