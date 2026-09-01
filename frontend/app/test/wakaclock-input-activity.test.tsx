import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ClipboardCoverageNotice } from '@/app/dashboard/(auth)/wakaclock/keystrokes/page';

describe('Input Activity clipboard coverage', () => {
  it('distinguishes unavailable, partial, and complete coverage', () => {
    const { rerender } = render(<ClipboardCoverageNotice percent={0} />);
    expect(screen.getByText('Clipboard tracking was not available for this range')).toBeVisible();

    rerender(<ClipboardCoverageNotice percent={42.5} />);
    expect(screen.getByText('Partial clipboard coverage')).toBeVisible();
    expect(screen.getByText(/42.5%/)).toBeVisible();

    rerender(<ClipboardCoverageNotice percent={100} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
