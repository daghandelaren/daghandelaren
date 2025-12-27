import { ScrapedSentiment } from '@/types';
import { normalizeSymbol } from '@/lib/utils';

// Symbol mapping for FXBlue instruments to canonical format
const SYMBOL_MAP: Record<string, string> = {
  // Forex pairs - various formats to standard
  'EURUSD': 'EUR/USD',
  'EUR/USD': 'EUR/USD',
  'GBPUSD': 'GBP/USD',
  'GBP/USD': 'GBP/USD',
  'USDJPY': 'USD/JPY',
  'USD/JPY': 'USD/JPY',
  'USDCHF': 'USD/CHF',
  'USD/CHF': 'USD/CHF',
  'AUDUSD': 'AUD/USD',
  'AUD/USD': 'AUD/USD',
  'USDCAD': 'USD/CAD',
  'USD/CAD': 'USD/CAD',
  'NZDUSD': 'NZD/USD',
  'NZD/USD': 'NZD/USD',
  'EURJPY': 'EUR/JPY',
  'EUR/JPY': 'EUR/JPY',
  'GBPJPY': 'GBP/JPY',
  'GBP/JPY': 'GBP/JPY',
  'EURGBP': 'EUR/GBP',
  'EUR/GBP': 'EUR/GBP',
  'EURAUD': 'EUR/AUD',
  'EUR/AUD': 'EUR/AUD',
  'EURCAD': 'EUR/CAD',
  'EUR/CAD': 'EUR/CAD',
  'EURCHF': 'EUR/CHF',
  'EUR/CHF': 'EUR/CHF',
  'EURNZD': 'EUR/NZD',
  'EUR/NZD': 'EUR/NZD',
  'GBPAUD': 'GBP/AUD',
  'GBP/AUD': 'GBP/AUD',
  'GBPCAD': 'GBP/CAD',
  'GBP/CAD': 'GBP/CAD',
  'GBPCHF': 'GBP/CHF',
  'GBP/CHF': 'GBP/CHF',
  'GBPNZD': 'GBP/NZD',
  'GBP/NZD': 'GBP/NZD',
  'AUDJPY': 'AUD/JPY',
  'AUD/JPY': 'AUD/JPY',
  'AUDCAD': 'AUD/CAD',
  'AUD/CAD': 'AUD/CAD',
  'AUDCHF': 'AUD/CHF',
  'AUD/CHF': 'AUD/CHF',
  'AUDNZD': 'AUD/NZD',
  'AUD/NZD': 'AUD/NZD',
  'NZDJPY': 'NZD/JPY',
  'NZD/JPY': 'NZD/JPY',
  'NZDCAD': 'NZD/CAD',
  'NZD/CAD': 'NZD/CAD',
  'NZDCHF': 'NZD/CHF',
  'NZD/CHF': 'NZD/CHF',
  'CADJPY': 'CAD/JPY',
  'CAD/JPY': 'CAD/JPY',
  'CADCHF': 'CAD/CHF',
  'CAD/CHF': 'CAD/CHF',
  'CHFJPY': 'CHF/JPY',
  'CHF/JPY': 'CHF/JPY',
  // Commodities
  'XAUUSD': 'XAU/USD',
  'XAU/USD': 'XAU/USD',
  'XAGUSD': 'XAG/USD',
  'XAG/USD': 'XAG/USD',
  'GOLD': 'XAU/USD',
  'SILVER': 'XAG/USD',
};

// Symbols to exclude from scraping
const BLOCKED_SYMBOLS = new Set(['BTC', 'ETH', 'BTCUSD', 'ETHUSD']);

/**
 * Raw position data extracted from FXBlue
 */
export interface FxbluePosition {
  symbol: string;
  longPercent: number;
  shortPercent: number;
}

/**
 * Normalize FXBlue symbol to canonical format
 */
export function normalizeFxblueSymbol(symbol: string): string | null {
  // Clean the symbol
  const cleaned = symbol.toUpperCase().replace(/[_-]/g, '').trim();

  // Check blocklist
  if (BLOCKED_SYMBOLS.has(cleaned)) {
    return null;
  }

  // Check direct mapping first
  if (SYMBOL_MAP[cleaned]) {
    return SYMBOL_MAP[cleaned];
  }

  // Check with slash format
  const withSlash = symbol.toUpperCase().replace(/[_-]/g, '/').trim();
  if (SYMBOL_MAP[withSlash]) {
    return SYMBOL_MAP[withSlash];
  }

  // Try to parse as 6-char forex pair
  if (cleaned.length === 6 && /^[A-Z]{6}$/.test(cleaned)) {
    return `${cleaned.slice(0, 3)}/${cleaned.slice(3)}`;
  }

  // Fallback to generic normalization
  return normalizeSymbol(symbol);
}

/**
 * Parse FXBlue position data
 * Converts raw extracted data to ScrapedSentiment format
 */
export function parseFxblueData(positions: FxbluePosition[]): ScrapedSentiment[] {
  const results: ScrapedSentiment[] = [];
  const seen = new Set<string>();

  for (const position of positions) {
    const normalizedSymbol = normalizeFxblueSymbol(position.symbol);
    if (!normalizedSymbol) continue;

    const key = normalizedSymbol.replace(/[/_-]/g, '').toUpperCase();

    // Skip duplicates
    if (seen.has(key)) continue;

    // Validate percentages
    if (!isValidPercentage(position.longPercent) || !isValidPercentage(position.shortPercent)) {
      continue;
    }

    seen.add(key);
    results.push({
      symbol: normalizedSymbol,
      longPercent: Math.round(position.longPercent * 100) / 100,
      shortPercent: Math.round(position.shortPercent * 100) / 100,
    });
  }

  return results;
}

/**
 * Validate percentage value
 */
function isValidPercentage(value: number): boolean {
  return !isNaN(value) && value >= 0 && value <= 100;
}
