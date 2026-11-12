export const ITEM_UNITS = [
  'L',
  'kg',
  'g',
  'ml',
  'pcs',
  'packet',
  'dozen',
  'box',
  'other',
] as const;

export type ItemUnit = (typeof ITEM_UNITS)[number];

export const ITEM_UNIT_LABELS: Record<ItemUnit, string> = {
  L: 'L (Litre)',
  kg: 'kg (Kilogram)',
  g: 'g (Gram)',
  ml: 'ml (Millilitre)',
  pcs: 'pcs (Pieces)',
  packet: 'packet',
  dozen: 'dozen',
  box: 'box',
  other: 'other',
};

export function normalizeItemUnit(unit: string | null | undefined): ItemUnit {
  if (!unit) return 'pcs';
  const cleaned = unit.trim();
  const lower = cleaned.toLowerCase();
  if (lower === 'l' || lower === 'litre' || lower === 'liter') return 'L';
  if ((ITEM_UNITS as readonly string[]).includes(cleaned)) {
    return cleaned as ItemUnit;
  }
  const matched = ITEM_UNITS.find((u) => u.toLowerCase() === lower);
  return matched || 'other';
}

export function formatQuantityWithUnit(
  quantity: number | null | undefined,
  unit?: string | null
): string {
  if (quantity === null || quantity === undefined || Number.isNaN(Number(quantity))) {
    return '-';
  }
  const num = Number(quantity);
  if (num <= 0) return '-';
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(num);
  return unit ? `${formatted} ${unit}` : formatted;
}
