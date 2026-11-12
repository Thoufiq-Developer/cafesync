/**
 * Password and username utilities for CafeLedger manager provisioning.
 * Pure, dependency-free helpers safe for both client and server modules.
 */

const READABLE_WORDS = [
  'Cafe',
  'Brew',
  'Herb',
  'Star',
  'Peak',
  'Bean',
  'Pure',
  'Zest',
  'Warm',
  'Ruby',
  'Jade',
  'Fern',
  'Sage',
  'Dawn',
  'Moon',
  'Wave',
];

const UNAMBIGUOUS_DIGITS = '23456789';

function randomIndex(max: number): number {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    globalThis.crypto.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Generates a readable 9-character password (e.g. "Brew-4829") using
 * unambiguous characters that managers can type easily on mobile phones.
 */
export function generateReadablePassword(): string {
  const word = READABLE_WORDS[randomIndex(READABLE_WORDS.length)];
  let digits = '';
  for (let i = 0; i < 4; i++) {
    digits += UNAMBIGUOUS_DIGITS[randomIndex(UNAMBIGUOUS_DIGITS.length)];
  }
  return `${word}-${digits}`;
}

/**
 * Normalizes a shop code or label into a clean lowercase username (e.g. "anna-nagar-01").
 */
export function slugifyUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48);
}

export function suggestUsernameFromShop(code: string, name?: string): string {
  const fromCode = slugifyUsername(code || '');
  if (fromCode.length >= 2) return fromCode;
  const fromName = slugifyUsername(name || '');
  return fromName.length >= 2 ? fromName : 'shop-manager-01';
}

export function isValidUsername(username: string): boolean {
  const clean = username.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{1,47}$/.test(clean);
}

/**
 * Builds the internal synthetic Supabase Auth email for managers without real email addresses.
 */
export function buildSyntheticEmail(username: string, brandSlug?: string | null): string {
  const cleanUser = slugifyUsername(username) || 'manager';
  const cleanSlug =
    (brandSlug || 'brand')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'brand';
  return `${cleanUser}@${cleanSlug}.cafeledger.app`;
}

export function isSyntheticEmail(email?: string | null): boolean {
  return Boolean(email && email.toLowerCase().endsWith('.cafeledger.app'));
}
