import {
  Geist,
  Hedvig_Letters_Serif,
  Inter,
  Kumbh_Sans,
  Montserrat,
  Outfit,
  Overpass_Mono,
  Plus_Jakarta_Sans,
  Poppins,
  PT_Sans,
  Roboto,
} from 'next/font/google';

import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
});

const plus_jakarta_sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '800'],
  variable: '--font-plus-jakarta-sans',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-montserrat',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-poppins',
});

const overpass_mono = Overpass_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-overpass-mono',
});

const ptSans = PT_Sans({
  variable: '--font-pt-sans',
  subsets: ['latin'],
  weight: ['400', '700'],
});

const hedvig_letters_serif = Hedvig_Letters_Serif({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-hedvig-letters-serif',
});

const kumbh_sans = Kumbh_Sans({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-kumbh-sans',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-outfit',
});

export const fontVariables = cn(
  geist.variable,
  inter.variable,
  roboto.variable,
  montserrat.variable,
  poppins.variable,
  overpass_mono.variable,
  ptSans.variable,
  plus_jakarta_sans.variable,
  hedvig_letters_serif.variable,
  kumbh_sans.variable,
  outfit.variable
);
