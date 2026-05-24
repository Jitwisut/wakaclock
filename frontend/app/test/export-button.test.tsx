import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import { ExportButton } from '@/components/CardActionMenus';

it('renders a button with an accessible label', () => {
  render(<ExportButton />);

  expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
});

it('supports overriding labels and treats missing onExport as a no-op', async () => {
  const user = userEvent.setup();

  render(
    <ExportButton
      labels={{
        button: 'Download',
        excel: 'XLSX',
        pdf: 'Portable',
      }}
    />
  );

  await user.click(screen.getByRole('button', { name: 'Download' }));
  await user.click(await screen.findByRole('menuitem', { name: 'XLSX' }));

  await user.click(screen.getByRole('button', { name: 'Download' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Portable' }));
});

it('disables the trigger button when disabled', () => {
  render(<ExportButton disabled labels={{ button: 'Export' }} />);

  expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
});

it('calls onExport when selecting a format', async () => {
  const user = userEvent.setup();
  const onExport = vi.fn();

  render(<ExportButton onExport={onExport} />);

  await user.click(screen.getByRole('button', { name: 'Export' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Excel' }));

  await user.click(screen.getByRole('button', { name: 'Export' }));
  await user.click(await screen.findByRole('menuitem', { name: 'PDF' }));

  expect(onExport).toHaveBeenCalledTimes(2);
  expect(onExport).toHaveBeenNthCalledWith(1, 'excel');
  expect(onExport).toHaveBeenNthCalledWith(2, 'pdf');
});
