import { faker } from '@faker-js/faker';

export interface FakeLogo {
  alt: string;
  height: number;
  href: string;
  src: string;
  width: number;
}

export function createFakeLogo(): FakeLogo {
  return {
    alt: faker.company.name(),
    href: '/',
    src: faker.image.url({ width: 120, height: 40 }),
    width: 120,
    height: 40,
  };
}

export function createFakeLogos(count = 5): FakeLogo[] {
  return Array.from({ length: count }, () => createFakeLogo());
}

export function createFakeLogoAlt(): string {
  return `${faker.company.name()} logo`;
}

export function createFakeLogoSrc(): string {
  return faker.image.url({ width: 120, height: 40 });
}
