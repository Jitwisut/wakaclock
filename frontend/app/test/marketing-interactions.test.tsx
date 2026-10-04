import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignPage, campaignPageMetadata } from '@/components/marketing/campaign-page';
import { FormSubmitButton } from '@/components/marketing/form-submit-button';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { isNavLinkActive } from '@/components/marketing/nav-links.data';
import { QuickStartSection } from '@/components/marketing/quick-start-section';

const pathname = vi.hoisted(() => ({ value: '/' as string | null }));
const linkStatus = vi.hoisted(() => ({ pending: false }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
}));

vi.mock('next/link', async () => {
  const actual = await vi.importActual<typeof import('next/link')>('next/link');

  return { ...actual, useLinkStatus: () => linkStatus };
});

beforeEach(() => {
  pathname.value = '/';
  linkStatus.pending = false;
});

describe('isNavLinkActive', () => {
  it('matches the exact page, its children, and nothing else', () => {
    expect(isNavLinkActive('/pricing', '/pricing')).toBe(true);
    expect(isNavLinkActive('/docs/getting-started', '/docs/getting-started')).toBe(true);
    expect(isNavLinkActive('/pricing', '/teams')).toBe(false);
    expect(isNavLinkActive('/pricing-archive', '/pricing')).toBe(false);
  });

  it('ignores the Thai locale prefix so /th/pricing marks the Pricing link', () => {
    expect(isNavLinkActive('/th/pricing', '/pricing')).toBe(true);
    expect(isNavLinkActive('/th', '/')).toBe(true);
    expect(isNavLinkActive('/th/pricing', '/')).toBe(false);
  });
});

describe('MarketingNav', () => {
  it('keeps navigation and the language switch usable before the pathname is ready', () => {
    pathname.value = null;
    render(<MarketingNav locale="en" />);
    expect(screen.getByRole('link', { name: 'อ่านภาษาไทย' })).toHaveAttribute('href', '/th');
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing');
  });

  it('marks the current page with aria-current in both the bar and the mobile menu', () => {
    pathname.value = '/pricing';
    render(<MarketingNav locale="en" />);

    const [barLink] = screen.getAllByRole('link', { name: 'Pricing' });
    expect(barLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Teams' })).not.toHaveAttribute('aria-current');
  });

  it('opens and closes the mobile menu, and closes it on Escape', () => {
    render(<MarketingNav locale="en" />);

    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeInTheDocument();

    fireEvent.click(toggle);

    const menu = document.querySelector('#marketing-mobile-menu');
    expect(menu).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    // The nav points at the section hub, not a page inside it: linking
    // `/docs/getting-started` directly left `/docs` with no inbound link anywhere on the
    // site, and Google declined to crawl it.
    expect(within(menu as HTMLElement).getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'href',
      '/docs'
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.querySelector('#marketing-mobile-menu')).toBeNull();
  });

  it('localises destinations and the menu label for Thai', () => {
    pathname.value = '/th';
    render(<MarketingNav locale="th" />);

    expect(screen.getByRole('link', { name: 'ราคา' })).toHaveAttribute('href', '/th/pricing');
    expect(screen.getByRole('button', { name: 'เปิดเมนู' })).toBeInTheDocument();
  });

  it('shows a pending marker on links while a navigation they started is in flight', () => {
    linkStatus.pending = true;
    render(<MarketingNav locale="en" />);

    expect(screen.getAllByTestId('link-pending').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Loading page');
  });
});

describe('QuickStartSection', () => {
  it('numbers the steps and quotes the real CLI commands', () => {
    render(<QuickStartSection locale="en" />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Three steps to your first heartbeat'
    );
    expect(screen.getByText('wakaclock-cli config set-key YOUR_API_KEY')).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Read the full setup guide/ })).toHaveAttribute(
      'href',
      '/docs/getting-started'
    );
  });

  it('links to the Thai guide when rendered in Thai', () => {
    render(<QuickStartSection locale="th" />);

    expect(screen.getByRole('link', { name: /อ่านคู่มือการติดตั้งฉบับเต็ม/ })).toHaveAttribute(
      'href',
      '/th/docs/getting-started'
    );
  });
});

describe('CampaignPage', () => {
  it('states the offer and the Early Access limits on the same page', () => {
    render(<CampaignPage locale="en" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your coding history');
    expect(screen.getByRole('link', { name: /Get my Early Access key/ })).toHaveAttribute(
      'href',
      '#early-access'
    );
    expect(screen.getByText(/Early Access is a waiting list, not a checkout/)).toBeInTheDocument();
    expect(screen.getByText(/no free tier at launch/)).toBeInTheDocument();
  });

  it('names the brand once in the title, despite the root layout template', () => {
    const en = campaignPageMetadata('en');
    const th = campaignPageMetadata('th');

    expect(en.title).toEqual({ absolute: expect.stringContaining('AtoAxis —') });
    expect(JSON.stringify(en.title)).not.toContain('| AtoAxis');
    expect(en.alternates?.canonical).toBe('/join');
    expect(th.alternates?.canonical).toBe('/th/join');
  });

  it('renders the Thai campaign with Thai destinations', () => {
    render(<CampaignPage locale="th" />);

    expect(screen.getByRole('link', { name: /เทียบกับเจ้าอื่นในตลาด/ })).toHaveAttribute(
      'href',
      '/th/wakatime-alternative'
    );
    expect(screen.getByRole('heading', { name: 'ก่อนตัดสินใจลงทะเบียน' })).toBeInTheDocument();
  });
});

describe('FormSubmitButton', () => {
  it('switches to the pending label and disables itself once the form submits', () => {
    render(
      <form onSubmit={(event) => event.preventDefault()}>
        <FormSubmitButton label="Join the list" pendingLabel="Sending…" />
      </form>
    );

    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Join the list' });
    expect(button).toHaveAttribute('aria-busy', 'false');

    fireEvent.submit(button.form as HTMLFormElement);

    const pendingButton = screen.getByRole('button', { name: /Sending/ });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute('aria-busy', 'true');
  });

  it('does nothing when it is rendered outside a form', () => {
    render(<FormSubmitButton label="Join the list" pendingLabel="Sending…" />);

    expect(screen.getByRole('button', { name: 'Join the list' })).toBeEnabled();
  });
});

it('closes the mobile menu after each destination, outside pointer, or route change', () => {
  const view = render(<MarketingNav />);
  for (const href of ['/docs', '/early-access', '/login']) {
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = document.querySelector('#marketing-mobile-menu')!;
    fireEvent.pointerDown(menu);
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(menu).toBeInTheDocument();
    const link = menu.querySelector<HTMLAnchorElement>(`a[href="${href}"]`)!;
    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);
    expect(document.querySelector('#marketing-mobile-menu')).toBeNull();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  fireEvent.pointerDown(document.body);
  expect(document.querySelector('#marketing-mobile-menu')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  pathname.value = '/teams';
  view.rerender(<MarketingNav />);
  expect(document.querySelector('#marketing-mobile-menu')).toBeNull();
  expect(screen.getByRole('link', { name: 'Teams' })).toHaveAttribute('aria-current', 'page');
});
