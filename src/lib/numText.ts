/**
 * Splits a displayed value like "+82.5 kg" into the parts a count-up needs: what comes
 * before the number, the number itself, and a trailing unit. Text with more than one
 * number ("1:05", "3 × 8") or none ("—") isn't a single figure, so it returns null.
 */
export interface NumText {
  prefix: string;
  value: number;
  decimals: number;
  grouped: boolean;
  /** A thousands or millions marker that belongs with the figure: the K in "1.8K AU". */
  magnitude: string;
  unit: string;
}

const PATTERN = /^([^\d]*?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?([KM](?![A-Za-z]))?(\s*[^\d]*)$/;

export function parseNumText(text: string): NumText | null {
  const m = PATTERN.exec(text);
  if (!m) return null;
  const [, prefix, whole, frac = '', magnitude = '', unit] = m;
  return {
    prefix,
    value: Number(whole.replace(/,/g, '') + (frac ? `.${frac}` : '')),
    decimals: frac.length,
    grouped: whole.includes(','),
    magnitude,
    unit,
  };
}

/** The number as it would be shown mid-count, keeping the original's decimals and grouping. */
export function formatNum(value: number, { decimals, grouped }: Pick<NumText, 'decimals' | 'grouped'>): string {
  const fixed = value.toFixed(decimals);
  if (!grouped) return fixed;
  const [whole, frac] = fixed.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? `.${frac}` : '');
}
