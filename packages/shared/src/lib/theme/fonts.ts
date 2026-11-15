import {
  Inter,
  Poppins,
  Nunito,
  Montserrat,
  Playfair_Display,
  DM_Sans,
} from 'next/font/google';

export const fontInter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-brand-inter',
  display: 'swap',
});

export const fontPoppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-brand-poppins',
  display: 'swap',
});

export const fontNunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-brand-nunito',
  display: 'swap',
});

export const fontMontserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-brand-montserrat',
  display: 'swap',
});

export const fontPlayfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-brand-playfair',
  display: 'swap',
});

export const fontDmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-brand-dmsans',
  display: 'swap',
});

export const ALL_FONT_VARIABLE_CLASSES = [
  fontInter.variable,
  fontPoppins.variable,
  fontNunito.variable,
  fontMontserrat.variable,
  fontPlayfair.variable,
  fontDmSans.variable,
].join(' ');

