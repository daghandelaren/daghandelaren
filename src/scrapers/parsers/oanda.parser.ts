import { ScrapedSentiment } from '@/types';

interface RawOandaData {
  symbol: string;
  long: number;
  short: number;
}

// Symbol normalization mappings
const SYMBOL_MAPPINGS: Record<string, string> = {
  // Forex pairs - normalize to BASE/QUOTE format
  'EUR_USD': 'EUR/USD',
  'EURUSD': 'EUR/USD',
  'GBP_USD': 'GBP/USD',
  'GBPUSD': 'GBP/USD',
  'USD_JPY': 'USD/JPY',
  'USDJPY': 'USD/JPY',
  'USD_CHF': 'USD/CHF',
  'USDCHF': 'USD/CHF',
  'AUD_USD': 'AUD/USD',
  'AUDUSD': 'AUD/USD',
  'NZD_USD': 'NZD/USD',
  'NZDUSD': 'NZD/USD',
  'USD_CAD': 'USD/CAD',
  'USDCAD': 'USD/CAD',
  'EUR_GBP': 'EUR/GBP',
  'EURGBP': 'EUR/GBP',
  'EUR_JPY': 'EUR/JPY',
  'EURJPY': 'EUR/JPY',
  'EUR_CHF': 'EUR/CHF',
  'EURCHF': 'EUR/CHF',
  'GBP_JPY': 'GBP/JPY',
  'GBPJPY': 'GBP/JPY',
  'GBP_CHF': 'GBP/CHF',
  'GBPCHF': 'GBP/CHF',
  'AUD_JPY': 'AUD/JPY',
  'AUDJPY': 'AUD/JPY',
  'AUD_NZD': 'AUD/NZD',
  'AUDNZD': 'AUD/NZD',
  'AUD_CAD': 'AUD/CAD',
  'AUDCAD': 'AUD/CAD',
  'AUD_CHF': 'AUD/CHF',
  'AUDCHF': 'AUD/CHF',
  'CAD_JPY': 'CAD/JPY',
  'CADJPY': 'CAD/JPY',
  'CAD_CHF': 'CAD/CHF',
  'CADCHF': 'CAD/CHF',
  'CHF_JPY': 'CHF/JPY',
  'CHFJPY': 'CHF/JPY',
  'EUR_AUD': 'EUR/AUD',
  'EURAUD': 'EUR/AUD',
  'EUR_CAD': 'EUR/CAD',
  'EURCAD': 'EUR/CAD',
  'EUR_NZD': 'EUR/NZD',
  'EURNZD': 'EUR/NZD',
  'GBP_AUD': 'GBP/AUD',
  'GBPAUD': 'GBP/AUD',
  'GBP_CAD': 'GBP/CAD',
  'GBPCAD': 'GBP/CAD',
  'GBP_NZD': 'GBP/NZD',
  'GBPNZD': 'GBP/NZD',
  'NZD_CAD': 'NZD/CAD',
  'NZDCAD': 'NZD/CAD',
  'NZD_CHF': 'NZD/CHF',
  'NZDCHF': 'NZD/CHF',
  'NZD_JPY': 'NZD/JPY',
  'NZDJPY': 'NZD/JPY',
  // Commodities
  'XAU_USD': 'XAU/USD',
  'XAUUSD': 'XAU/USD',
  'GOLD': 'XAU/USD',
  'XAG_USD': 'XAG/USD',
  'XAGUSD': 'XAG/USD',
  'SILVER': 'XAG/USD',
  'WTICO_USD': 'WTI/USD',
  'BCO_USD': 'BRENT/USD',
  // Indices - OANDA names
  'US30_USD': 'US30',
  'SPX500_USD': 'SPX500',
  'NAS100_USD': 'NAS100',
  'DE30_EUR': 'DE30',
  'US WALL ST 30': 'US30',
  'US SPX 500': 'SPX500',
  'US NAS 100': 'NAS100',
  // OANDA GraphQL API format
  'US100': 'NAS100',
  'US500': 'SPX500',
  'US30': 'US30',
  'JP225': 'JP225',
  'HK50': 'HK50',
  // Crypto
  'BITCOIN': 'BTC/USD',
  'BTC_USD': 'BTC/USD',
  'BTCUSD': 'BTC/USD',
  'ETHEREUM': 'ETH/USD',
  'ETH_USD': 'ETH/USD',
  'ETHUSD': 'ETH/USD',
};

// Symbols to exclude from scraping
const BLOCKED_SYMBOLS = new Set(['UK100', 'HK33', 'JP225', 'UK100_GBP', 'HONG KONG 33', 'JAPAN 225']);

/**
 * Normalize OANDA symbol to standard format
 * Handles: EUR/USD, EURUSD, EUR_USD -> EUR/USD
 * Returns null for blocked symbols
 */
export function normalizeOandaSymbol(symbol: string): string | null {
  const upper = symbol.toUpperCase().trim();

  // Check blocklist first
  if (BLOCKED_SYMBOLS.has(upper)) {
    return null;
  }

  // Check direct mapping first
  if (SYMBOL_MAPPINGS[upper]) {
    return SYMBOL_MAPPINGS[upper];
  }

  // Try without separator
  const noSep = upper.replace(/[/_-]/g, '');
  if (SYMBOL_MAPPINGS[noSep]) {
    return SYMBOL_MAPPINGS[noSep];
  }

  // If 6 characters (e.g., EURUSD), split into BASE/QUOTE
  if (noSep.length === 6 && /^[A-Z]+$/.test(noSep)) {
    return `${noSep.slice(0, 3)}/${noSep.slice(3)}`;
  }

  // Already has separator, normalize it
  if (upper.includes('_') || upper.includes('-')) {
    return upper.replace(/[_-]/g, '/');
  }

  return upper;
}

/**
 * Determine asset class from symbol
 */
export function getAssetClass(symbol: string): 'fx' | 'commodity' | 'index' | 'crypto' {
  const upper = symbol.toUpperCase();

  // Crypto
  if (upper.includes('BTC') || upper.includes('ETH') || upper.includes('BITCOIN') || upper.includes('ETHEREUM')) {
    return 'crypto';
  }

  // Commodities
  if (upper.includes('XAU') || upper.includes('XAG') || upper.includes('WTI') || upper.includes('BCO') || upper.includes('BRENT') || upper === 'GOLD' || upper === 'SILVER') {
    return 'commodity';
  }

  // Indices
  if (upper.includes('SPX') || upper.includes('NAS') || upper.includes('US30') || upper.includes('DE30')) {
    return 'index';
  }

  return 'fx';
}

/**
 * Parse OANDA sentiment data from DOM extraction
 */
export function parseOandaData(rawData: RawOandaData[], htmlContent?: string): ScrapedSentiment[] {
  const results: ScrapedSentiment[] = [];
  const seen = new Set<string>();

  // Process extracted data from DOM
  for (const item of rawData) {
    const normalizedSymbol = normalizeOandaSymbol(item.symbol);
    if (!normalizedSymbol) continue;

    // Skip duplicates
    if (seen.has(normalizedSymbol)) continue;
    seen.add(normalizedSymbol);

    // Validate percentages
    if (!isValidPercentage(item.long) || !isValidPercentage(item.short)) {
      continue;
    }

    // Ensure they add up to ~100% (with tolerance for rounding)
    const sum = item.long + item.short;
    if (sum < 95 || sum > 105) {
      continue;
    }

    results.push({
      symbol: normalizedSymbol,
      longPercent: item.long,
      shortPercent: item.short,
    });
  }

  // Always try HTML parsing to capture additional instruments
  // This is important because OANDA uses compact format that DOM extraction might miss
  if (htmlContent) {
    const htmlParsed = parseOandaHtml(htmlContent);
    for (const item of htmlParsed) {
      // Only add if not already captured from DOM
      if (!seen.has(item.symbol)) {
        seen.add(item.symbol);
        results.push(item);
      }
    }
  }

  return results;
}

/**
 * Parse OANDA network/API response
 */
export function parseOandaNetworkResponse(jsonString: string): ScrapedSentiment[] {
  try {
    const data = JSON.parse(jsonString);
    const results: ScrapedSentiment[] = [];
    const seen = new Set<string>();

    // Handle various response structures
    const items = extractItemsFromResponse(data);

    for (const item of items) {
      const rawSymbol = item.instrument || item.symbol || item.name || item.pair;
      if (!rawSymbol || typeof rawSymbol !== 'string') continue;

      const normalizedSymbol = normalizeOandaSymbol(rawSymbol);
      if (!normalizedSymbol) continue;
      if (seen.has(normalizedSymbol)) continue;

      // Extract percentages from various field names
      let longPercent = item.longPercent ?? item.long ?? item.longPositionPercent ?? item.buyPercent ?? item.buy;
      let shortPercent = item.shortPercent ?? item.short ?? item.shortPositionPercent ?? item.sellPercent ?? item.sell;

      // Handle ratio format (e.g., 0.65 instead of 65)
      if (typeof longPercent === 'number' && longPercent <= 1) {
        longPercent = longPercent * 100;
      }
      if (typeof shortPercent === 'number' && shortPercent <= 1) {
        shortPercent = shortPercent * 100;
      }

      // If only one is provided, calculate the other
      if (typeof longPercent === 'number' && typeof shortPercent !== 'number') {
        shortPercent = 100 - longPercent;
      } else if (typeof shortPercent === 'number' && typeof longPercent !== 'number') {
        longPercent = 100 - shortPercent;
      }

      if (!isValidPercentage(longPercent) || !isValidPercentage(shortPercent)) {
        continue;
      }

      seen.add(normalizedSymbol);
      results.push({
        symbol: normalizedSymbol,
        longPercent,
        shortPercent,
      });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Extract items array from various response structures
 */
function extractItemsFromResponse(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) {
    return data;
  }

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;

    // Try common field names
    const possibleArrayFields = [
      'instruments', 'positions', 'sentiments', 'data', 'items',
      'ratios', 'pairs', 'currencies', 'results'
    ];

    for (const field of possibleArrayFields) {
      if (Array.isArray(obj[field])) {
        return obj[field] as Array<Record<string, unknown>>;
      }
    }

    // Check nested data
    if (obj.data && typeof obj.data === 'object') {
      return extractItemsFromResponse(obj.data);
    }
  }

  return [];
}

/**
 * Parse OANDA HTML content directly
 */
export function parseOandaHtml(html: string): ScrapedSentiment[] {
  const results: ScrapedSentiment[] = [];
  const seen = new Set<string>();

  // Pattern to match forex pairs with percentages
  const patterns = [
    // Pattern 1: Newline-separated format "EUR/USD\n72%\n28%" (OANDA proptrader innerText format)
    /([A-Z]{3}\/[A-Z]{3})[\s\n]+(\d+(?:\.\d+)?)[\s\n]*%[\s\n]+(\d+(?:\.\d+)?)[\s\n]*%/gi,
    // Pattern 2: Compact format "EUR/USD72%28%" (no spaces)
    /([A-Z]{3}\/[A-Z]{3})(\d+(?:\.\d+)?)%(\d+(?:\.\d+)?)%/gi,
    // Pattern 3: "SYMBOL 65% 35%" or "SYMBOL 65.2 34.8" (with spaces)
    /([A-Z]{3}[/_-]?[A-Z]{3})\s+(\d+(?:\.\d+)?)\s*%?\s+(\d+(?:\.\d+)?)\s*%?/gi,
    // Pattern 4: "65% long" paired with symbol nearby
    /([A-Z]{3}[/_-]?[A-Z]{3})[\s\S]{0,50}?(\d+(?:\.\d+)?)\s*%?\s*(?:long|buy)[\s\S]{0,20}?(\d+(?:\.\d+)?)\s*%?\s*(?:short|sell)/gi,
    // Pattern 5: JSON-like embedded data
    /"instrument"\s*:\s*"([A-Z_]+)"[\s\S]{0,100}?"(?:long|buy)(?:Percent)?"\s*:\s*(\d+(?:\.\d+)?)/gi,
    // Pattern 6: Named instruments (Bitcoin, Gold, Silver, indices)
    /(Bitcoin|Gold|Silver|US Wall St 30|US SPX 500|US Nas 100|Hong Kong 33|Japan 225)[\s\n]+(\d+(?:\.\d+)?)[\s\n]*%[\s\n]+(\d+(?:\.\d+)?)[\s\n]*%/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const rawSymbol = match[1].trim();

      // Skip malformed symbols (partial captures like "ITCOIN" from "Bitcoin")
      if (rawSymbol.length < 3) continue;
      if (/^[A-Z]{6}$/i.test(rawSymbol) && !SYMBOL_MAPPINGS[rawSymbol.toUpperCase()]) {
        // 6-char symbol that's not a known forex pair - likely malformed
        continue;
      }

      const symbol = normalizeOandaSymbol(rawSymbol);
      if (!symbol) continue;

      if (seen.has(symbol)) continue;

      // OANDA displays NET-SHORT first, then NET-LONG
      // So first value is short, second value is long
      let short = parseFloat(match[2]);
      let long = match[3] ? parseFloat(match[3]) : 100 - short;

      // Handle ratio format
      if (long <= 1) long = long * 100;
      if (short <= 1) short = short * 100;

      if (!isValidPercentage(long) || !isValidPercentage(short)) {
        continue;
      }

      seen.add(symbol);
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
function isValidPercentage(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= 0 && value <= 100;
}

/**
 * Parse JSON data if OANDA provides API response (legacy compatibility)
 */
export function parseOandaJson(json: string): ScrapedSentiment[] {
  return parseOandaNetworkResponse(json);
}
