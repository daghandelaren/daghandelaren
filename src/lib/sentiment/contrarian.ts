/**
 * Contrarian Sentiment Analysis
 *
 * We trade against retail sentiment:
 * - If retail is net long (long% > short%) => our bias = SHORT (label: BEARISH)
 * - If retail is net short (short% > long%) => our bias = LONG (label: BULLISH)
 *
 * Signal strength threshold: >= 20 percentage points difference
 * Below threshold => NEUTRAL
 */

export type ContrariaBias = 'LONG' | 'SHORT' | 'NEUTRAL';
export type ContrarianLabel = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface ContrarianResult {
  bias: ContrariaBias;
  label: ContrarianLabel;
  strength: number;
}

const SIGNAL_THRESHOLD = 19; // Triggers at 60/40 or greater (accounts for rounding)

/**
 * Compute contrarian sentiment from retail long/short percentages
 *
 * @param longPct - Retail long percentage (0-100)
 * @param shortPct - Retail short percentage (0-100)
 * @returns ContrarianResult with bias, label, and strength
 *
 * @example
 * computeContrarian(80, 20) // { bias: 'SHORT', label: 'BEARISH', strength: 60 }
 * computeContrarian(30, 70) // { bias: 'LONG', label: 'BULLISH', strength: 40 }
 * computeContrarian(55, 45) // { bias: 'NEUTRAL', label: 'NEUTRAL', strength: 10 }
 */
export function computeContrarian(longPct: number, shortPct: number): ContrarianResult {
  // Calculate strength as absolute difference
  const strength = Math.abs(longPct - shortPct);

  // If below threshold, return NEUTRAL
  if (strength < SIGNAL_THRESHOLD) {
    return {
      bias: 'NEUTRAL',
      label: 'NEUTRAL',
      strength,
    };
  }

  // Contrarian logic: trade against retail
  if (longPct > shortPct) {
    // Retail is net long => we go SHORT (bearish)
    return {
      bias: 'SHORT',
      label: 'BEARISH',
      strength,
    };
  } else {
    // Retail is net short => we go LONG (bullish)
    return {
      bias: 'LONG',
      label: 'BULLISH',
      strength,
    };
  }
}

/**
 * Get CSS classes for contrarian label styling
 */
export function getContrarianLabelColor(label: ContrarianLabel): string {
  switch (label) {
    case 'BULLISH':
      return 'text-sentiment-bullish';
    case 'BEARISH':
      return 'text-sentiment-bearish';
    case 'NEUTRAL':
      return 'text-gray-400';
  }
}

/**
 * Get background CSS classes for contrarian label
 */
export function getContrarianBgColor(label: ContrarianLabel): string {
  switch (label) {
    case 'BULLISH':
      return 'bg-sentiment-bullish/20';
    case 'BEARISH':
      return 'bg-sentiment-bearish/20';
    case 'NEUTRAL':
      return 'bg-gray-500/20';
  }
}
