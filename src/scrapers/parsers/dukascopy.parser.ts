import { ScrapedSentiment } from '@/types';
import { normalizeSymbol } from '@/lib/utils';

interface RawDukascopyData {
  symbol: string;
  long: number;
  short: number;
}

// Symbol mapping for Dukascopy instruments to canonical format
const SYMBOL_MAP: Record<string, string> = {
  // Forex pairs - Dukascopy format to standard
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
  // Indices
  'SPX500': 'SPX500',
  'US30': 'US30',
  'NAS100': 'NAS100',
  'DE30': 'DE30',
};

// Symbols to exclude from scraping
const BLOCKED_SYMBOLS = new Set(['UK100', 'HK33', 'JP225']);

/**
 * Normalize Dukascopy symbol to canonical format
 */
export function normalizeDukascopySymbol(symbol: string): string | null {
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
 * Get asset class from symbol
 */
export function getAssetClass(symbol: string): 'fx' | 'commodity' | 'index' {
  const upper = symbol.toUpperCase();

  // Commodities
  if (upper.includes('XAU') || upper.includes('XAG') || upper.includes('GOLD') || upper.includes('SILVER')) {
    return 'commodity';
  }

  // Indices
  if (/SPX|NAS|US30|DE30|DAX|FTSE|DOW/.test(upper)) {
    return 'index';
  }

  return 'fx';
}

/**
 * Parse Dukascopy network response (JSON)
 */
export function parseDukascopyNetworkResponse(responseText: string): Array<{ symbol: string; longPercent: number; shortPercent: number }> {
  const results: Array<{ symbol: string; longPercent: number; shortPercent: number }> = [];

  try {
    // Try to extract JSON from response
    let data: unknown;

    // Handle JSONP responses (callback(data))
    const jsonpMatch = responseText.match(/^\s*\w+\s*\(\s*([\s\S]*)\s*\)\s*;?\s*$/);
    if (jsonpMatch) {
      data = JSON.parse(jsonpMatch[1]);
    } else {
      data = JSON.parse(responseText);
    }

    // Process different response structures
    const items = extractSentimentItems(data);

    for (const item of items) {
      const parsed = parseSentimentItem(item);
      if (parsed) {
        results.push(parsed);
      }
    }
  } catch {
    // Try to extract data from non-JSON format
    const pattern = /([A-Z]{3}[/_]?[A-Z]{3})[^0-9]*(\d+(?:\.\d+)?)[^0-9]*(\d+(?:\.\d+)?)/gi;
    let match;
    while ((match = pattern.exec(responseText)) !== null) {
      const symbol = match[1];
      const val1 = parseFloat(match[2]);
      const val2 = parseFloat(match[3]);

      if (isValidPercentage(val1) && isValidPercentage(val2) && Math.abs(val1 + val2 - 100) < 5) {
        const normalizedSymbol = normalizeDukascopySymbol(symbol);
        if (normalizedSymbol) {
          results.push({
            symbol: normalizedSymbol,
            longPercent: val1,
            shortPercent: val2,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Extract sentiment items from various data structures
 */
function extractSentimentItems(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;

    // Look for common data container fields
    const containerFields = ['data', 'items', 'instruments', 'positions', 'sentiments', 'results', 'list'];
    for (const field of containerFields) {
      if (Array.isArray(obj[field])) {
        return obj[field] as unknown[];
      }
      if (typeof obj[field] === 'object' && obj[field] !== null) {
        const nested = obj[field] as Record<string, unknown>;
        for (const nestedField of containerFields) {
          if (Array.isArray(nested[nestedField])) {
            return nested[nestedField] as unknown[];
          }
        }
      }
    }

    // If object has symbol-like keys, treat values as items
    const items: unknown[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (/^[A-Z]{3}[/_]?[A-Z]{3}$/i.test(key) && typeof value === 'object') {
        items.push({ symbol: key, ...(value as object) });
      }
    }
    if (items.length > 0) return items;
  }

  return [];
}

/**
 * Parse a single sentiment item from various formats
 */
function parseSentimentItem(item: unknown): { symbol: string; longPercent: number; shortPercent: number } | null {
  if (typeof item !== 'object' || item === null) {
    return null;
  }

  const obj = item as Record<string, unknown>;

  // Extract symbol
  const symbol = obj.symbol || obj.instrument || obj.pair || obj.name || obj.currency || obj.id;
  if (typeof symbol !== 'string') return null;

  // Extract long/short percentages with various field names
  let longVal: number | undefined;
  let shortVal: number | undefined;

  // Try different field names for long position
  const longFields = ['long', 'longPercent', 'longPercentage', 'buy', 'bullish', 'bulls', 'buyers', 'longs'];
  for (const field of longFields) {
    if (typeof obj[field] === 'number') {
      longVal = obj[field] as number;
      break;
    }
  }

  // Try different field names for short position
  const shortFields = ['short', 'shortPercent', 'shortPercentage', 'sell', 'bearish', 'bears', 'sellers', 'shorts'];
  for (const field of shortFields) {
    if (typeof obj[field] === 'number') {
      shortVal = obj[field] as number;
      break;
    }
  }

  // Handle SWFX index format (single value -100 to +100)
  if (longVal === undefined && shortVal === undefined) {
    const indexFields = ['index', 'value', 'sentiment', 'swfx', 'net'];
    for (const field of indexFields) {
      if (typeof obj[field] === 'number') {
        const indexValue = obj[field] as number;
        // SWFX index: +20 means 60% long, 40% short
        longVal = 50 + indexValue / 2;
        shortVal = 50 - indexValue / 2;
        break;
      }
    }
  }

  // Handle ratio format (0-1 instead of 0-100)
  if (longVal !== undefined && longVal <= 1 && longVal >= 0) {
    longVal = longVal * 100;
  }
  if (shortVal !== undefined && shortVal <= 1 && shortVal >= 0) {
    shortVal = shortVal * 100;
  }

  // If only one value found, calculate the other
  if (longVal !== undefined && shortVal === undefined) {
    shortVal = 100 - longVal;
  } else if (shortVal !== undefined && longVal === undefined) {
    longVal = 100 - shortVal;
  }

  // Validate
  if (longVal === undefined || shortVal === undefined) return null;
  if (!isValidPercentage(longVal) || !isValidPercentage(shortVal)) return null;

  const normalizedSymbol = normalizeDukascopySymbol(symbol);
  if (!normalizedSymbol) return null;

  return {
    symbol: normalizedSymbol,
    longPercent: Math.round(longVal * 100) / 100,
    shortPercent: Math.round(shortVal * 100) / 100,
  };
}

/**
 * Parse Dukascopy sentiment data from page extraction
 */
export function parseDukascopyData(rawData: RawDukascopyData[], htmlContent?: string): ScrapedSentiment[] {
  const results: ScrapedSentiment[] = [];
  const seen = new Set<string>();

  // Process extracted data
  for (const item of rawData) {
    const normalizedSymbol = normalizeDukascopySymbol(item.symbol);
    if (!normalizedSymbol) continue;

    const key = normalizedSymbol.replace(/[/_-]/g, '').toUpperCase();

    // Skip duplicates
    if (seen.has(key)) continue;

    // Validate percentages
    if (!isValidPercentage(item.long) || !isValidPercentage(item.short)) {
      continue;
    }

    // Validate that they roughly sum to 100
    if (Math.abs(item.long + item.short - 100) > 5) {
      continue;
    }

    seen.add(key);
    results.push({
      symbol: normalizedSymbol,
      longPercent: item.long,
      shortPercent: item.short,
    });
  }

  // If no data from extraction, try parsing HTML directly
  if (results.length === 0 && htmlContent) {
    const htmlParsed = parseDukascopyHtml(htmlContent);
    for (const item of htmlParsed) {
      const key = item.symbol.replace(/[/_-]/g, '').toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    }
  }

  return results;
}

/**
 * Parse Dukascopy HTML content directly
 */
export function parseDukascopyHtml(html: string): ScrapedSentiment[] {
  const results: ScrapedSentiment[] = [];
  const seen = new Set<string>();

  // Dukascopy patterns - they use SWFX sentiment index
  const patterns = [
    // Pattern 1: Standard format with percentages
    /([A-Z]{3}[/_-]?[A-Z]{3})[\s\S]{0,100}?(\d+(?:\.\d+)?)\s*%[\s\S]{0,50}?(\d+(?:\.\d+)?)\s*%/gi,

    // Pattern 2: Table cell format
    /<td[^>]*>([A-Z]{3}[/_-]?[A-Z]{3})<\/td>[\s\S]*?<td[^>]*>(\d+(?:\.\d+)?)[^<]*<\/td>[\s\S]*?<td[^>]*>(\d+(?:\.\d+)?)[^<]*<\/td>/gi,

    // Pattern 3: SWFX index format (single value -100 to +100)
    /([A-Z]{3}[/_-]?[A-Z]{3})[\s\S]{0,50}?(?:swfx|index|sentiment)[\s\S]{0,30}?([+-]?\d+(?:\.\d+)?)/gi,

    // Pattern 4: Compact format without spaces
    /([A-Z]{3}[/_]?[A-Z]{3})(\d+(?:\.\d+)?)\s*%?\s*(\d+(?:\.\d+)?)\s*%?/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const symbol = normalizeDukascopySymbol(match[1]);
      if (!symbol) continue;

      const key = symbol.replace(/[/_-]/g, '').toUpperCase();

      if (seen.has(key)) continue;

      let long: number;
      let short: number;

      if (match[3]) {
        // Two values found
        long = parseFloat(match[2]);
        short = parseFloat(match[3]);
      } else {
        // Single SWFX index value (-100 to +100 where positive is bullish)
        const index = parseFloat(match[2]);
        long = 50 + index / 2;
        short = 50 - index / 2;
      }

      if (!isValidPercentage(long) || !isValidPercentage(short)) {
        continue;
      }

      // Validate sum (allow some tolerance)
      if (Math.abs(long + short - 100) > 5) {
        continue;
      }

      seen.add(key);
      results.push({
        symbol,
        longPercent: long,
        shortPercent: short,
      });
    }
  }

  return results;
}

/**
 * Validate percentage value
 */
function isValidPercentage(value: number): boolean {
  return !isNaN(value) && value >= 0 && value <= 100;
}

/**
 * Parse SWFX index data specifically
 */
export function parseSWFXIndex(data: Array<{ symbol: string; index: number }>): ScrapedSentiment[] {
  return data
    .filter((item) => item.symbol && typeof item.index === 'number')
    .map((item) => {
      const symbol = normalizeDukascopySymbol(item.symbol);
      return symbol ? {
        symbol,
        // SWFX index: +20 means 60% long (50 + 20/2), 40% short (50 - 20/2)
        longPercent: Math.max(0, Math.min(100, 50 + item.index / 2)),
        shortPercent: Math.max(0, Math.min(100, 50 - item.index / 2)),
      } : null;
    })
    .filter((item): item is ScrapedSentiment => item !== null);
}

/**
 * Parse JSON data if Dukascopy provides API response
 */
export function parseDukascopyJson(json: string): ScrapedSentiment[] {
  try {
    const data = JSON.parse(json);

    if (Array.isArray(data)) {
      return data
        .filter((item) => item.symbol || item.instrument)
        .map((item) => {
          const symbol = normalizeDukascopySymbol(item.symbol || item.instrument);
          if (!symbol) return null;

          // Handle different field names
          let long = item.long ?? item.longPercent ?? item.buy ?? item.bullish ?? item.index ?? 50;
          let short = item.short ?? item.shortPercent ?? item.sell ?? item.bearish;

          // Handle SWFX index format
          if (typeof item.index === 'number' && short === undefined) {
            long = 50 + item.index / 2;
            short = 50 - item.index / 2;
          } else if (short === undefined) {
            short = 100 - long;
          }

          return {
            symbol,
            longPercent: long,
            shortPercent: short,
          };
        })
        .filter((item): item is ScrapedSentiment => item !== null);
    }

    return [];
  } catch {
    return [];
  }
}
