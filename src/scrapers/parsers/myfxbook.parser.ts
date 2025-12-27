import { ScrapedSentiment, MyfxbookSymbol } from '@/types';
import { normalizeSymbol } from '@/lib/utils';

// Re-export the type for use in the scraper
export type { MyfxbookSymbol };

// Parse Myfxbook community outlook data
export function parseMyfxbookData(symbols: MyfxbookSymbol[]): ScrapedSentiment[] {
  const results: ScrapedSentiment[] = [];

  for (const symbol of symbols) {
    // Normalize the symbol name
    const normalizedSymbol = normalizeSymbol(symbol.name);

    // Validate percentages
    const longPercent = validatePercentage(symbol.longPercentage);
    const shortPercent = validatePercentage(symbol.shortPercentage);

    if (longPercent === null || shortPercent === null) {
      continue;
    }

    results.push({
      symbol: normalizedSymbol,
      longPercent,
      shortPercent,
    });
  }

  return results;
}

// Validate that a value is a valid percentage (0-100)
function validatePercentage(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null;
  }

  if (isNaN(value) || value < 0 || value > 100) {
    return null;
  }

  return value;
}

// Parse raw HTML/JSON if needed (for testing with sample data)
export function parseMyfxbookRaw(raw: string): ScrapedSentiment[] {
  try {
    const data = JSON.parse(raw);

    if (data.symbols && Array.isArray(data.symbols)) {
      return parseMyfxbookData(data.symbols);
    }

    return [];
  } catch {
    return [];
  }
}
