import { expect, it } from 'vitest';

import { cn, generateAvatarFallback, generateMeta, getInitials } from '@/lib/utils';

it('cn merges tailwind class conflicts', () => {
  expect(cn('p-2', 'p-4')).toBe('p-4');

  const merged = cn('p-2', { 'text-red-500': true, 'text-blue-500': false }, 'p-4');

  expect(merged).toContain('p-4');
  expect(merged).toContain('text-red-500');
  expect(merged).not.toContain('p-2');
  expect(merged).not.toContain('text-blue-500');
});

it('generateAvatarFallback returns initials for all words', () => {
  expect(generateAvatarFallback('Ada Lovelace')).toBe('AL');
  expect(generateAvatarFallback('  Ada   Byron   Lovelace  ')).toBe('ABL');
  expect(generateAvatarFallback('')).toBe('');
});

it('generateMeta builds a Metadata object with canonical dashboard path', () => {
  const meta = generateMeta({
    title: 'Login',
    description: 'Sign in to your account.',
    canonical: '/login',
  });

  expect(meta.title).toBe('Login - Shadcn UI Kit');
  expect(meta.description).toBe('Sign in to your account.');
  expect(meta.alternates?.canonical).toBe('/dashboard/login');
  expect(meta.metadataBase).toBeInstanceOf(URL);
  expect((meta.metadataBase as URL).href).toBe('https://shadcnuikit.com/');
  expect(meta.openGraph?.images).toEqual(['/images/seo.jpg']);
});

it('getInitials returns first and last initials (defensively)', () => {
  expect(getInitials('Ada Lovelace')).toBe('AL');
  expect(getInitials('Ada Byron Lovelace')).toBe('AL');
  expect(getInitials('Ada')).toBe('A');
  expect(getInitials('   ')).toBe('');
});
