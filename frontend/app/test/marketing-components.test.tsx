import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FaqSection } from '@/components/marketing/faq-section';
import { PricingSection } from '@/components/marketing/pricing-section';
import { PageIllustration } from '@/components/marketing/page-illustration';
import { CodeBlock, Section } from '@/components/marketing/prose';

it('keeps explanatory content immediately visible without requiring a reveal animation or code label', () => {
  render(
    <Section heading="Setup instructions" reveal={false}>
      <CodeBlock>npm run build</CodeBlock>
    </Section>
  );
  expect(
    screen.getByRole('heading', { name: 'Setup instructions' }).closest('section')
  ).not.toHaveClass('mkt-reveal');
  expect(screen.getByText('npm run build')).toBeVisible();
  expect(document.querySelector('figcaption')).toBeNull();
});

it('does not invent artwork for a page without an illustration', () => {
  const { container } = render(<PageIllustration path="/docs" locale="en" />);
  expect(container).toBeEmptyDOMElement();
});

describe('localized marketing components', () => {
  it('renders the Thai monthly/annual pricing toggle and localized CTA', () => {
    render(<PricingSection locale="th" />);

    expect(screen.getByRole('group', { name: 'รอบการเรียกเก็บเงิน' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /รายปี.*ประหยัด 31%/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('link', { name: 'เข้าร่วม Early Access' })).toHaveAttribute(
      'href',
      '/th/early-access'
    );

    fireEvent.click(screen.getByRole('button', { name: 'รายเดือน' }));

    expect(screen.getByRole('button', { name: 'รายเดือน' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('$12')).toBeInTheDocument();
    expect(screen.getByText('/เดือน')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /รายปี.*ประหยัด 31%/ }));
    expect(screen.getByText('$99')).toBeInTheDocument();
    expect(screen.getByText('/ปี')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'รายเดือน' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('keeps duplicate FAQ questions renderable without duplicate React keys', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      render(
        <FaqSection
          entries={[
            { question: 'Requirements — common question', answer: 'First answer' },
            { question: 'Requirements — common question', answer: 'Second answer' },
          ]}
        />
      );

      expect(screen.getAllByText('Requirements — common question')).toHaveLength(2);
      expect(consoleError.mock.calls.flat().join(' ')).not.toContain('same key');
    } finally {
      consoleError.mockRestore();
    }
  });
});
