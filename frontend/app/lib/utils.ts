import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { Metadata } from 'next';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateAvatarFallback(string: string) {
  const names = string.split(' ').filter(Boolean);
  const mapped = names.map((name: string) => name.charAt(0).toUpperCase());

  return mapped.join('');
}

export function generateMeta({
  title,
  description,
  canonical,
}: {
  canonical: string;
  description: string;
  title: string;
}): Metadata {
  return {
    title: `${title} - Shadcn UI Kit`,
    description,
    metadataBase: new URL(`https://shadcnuikit.com`),
    alternates: {
      canonical: `/dashboard${canonical}`,
    },
    openGraph: {
      images: [`/images/seo.jpg`],
    },
  };
}

// a function to get the first letter of the first and last name of names
export const getInitials = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (!parts[0]) return '';

  const firstNameInitial = parts[0].charAt(0).toUpperCase();
  if (parts.length === 1) return firstNameInitial;

  const lastName = parts[parts.length - 1];
  const lastNameInitial = lastName.charAt(0).toUpperCase();

  return `${firstNameInitial}${lastNameInitial}`;
};
