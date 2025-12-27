import { ScraperResult, ScrapedSentiment } from '@/types';
import { logger } from '@/lib/utils';
import { normalizeDukascopySymbol, getAssetClass } from './parsers/dukascopy.parser';

// Direct API endpoint for Dukascopy SWFX Sentiment Index
const DUKASCOPY_API_URL = 'https://freeserv.dukascopy.com/2.0/api/?group=quotes&method=realtimeSentimentIndex&enabled=true&key=bsq3l3p5lc8w4s0c&type=swfx';

interface DukascopyApiItem {
  id: string;
  title: string;
  date: string;
  long: string;
  short: string;
}

export async function scrapeDukascopy(): Promise<ScraperResult> {
  const timestamp = new Date();

  try {
    logger.debug('Fetching Dukascopy SWFX Sentiment API');

    const response = await fetch(DUKASCOPY_API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.dukascopy.com/swiss/english/marketwatch/sentiment/',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: DukascopyApiItem[] = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return {
        success: false,
        source: 'dukascopy',
        data: [],
        error: 'API returned empty or invalid data',
        timestamp,
      };
    }

    logger.debug(`Dukascopy API returned ${data.length} instruments`);

    // Parse and filter the data
    const parsedData: ScrapedSentiment[] = [];
    const seen = new Set<string>();

    for (const item of data) {
      // Only process forex pairs and commodities we care about
      const title = item.title || '';

      // Skip non-forex/commodity items (stocks, indices with specific naming)
      if (title.includes('.US/') || title.includes('.GB/') || title.includes('.DE/') ||
          title.includes('.FR/') || title.includes('.IT/') || title.includes('.CH/') ||
          title.includes('.JP/') || title.includes('.HK/') || title.includes('.SE/') ||
          title.includes('.NO/') || title.includes('.DK/') || title.includes('.NL/') ||
          title.includes('.AT/') || title.includes('.CMD/') || title.includes('.IDX/') ||
          title.includes('.TR/') || title.includes('/USD') && !isCurrencyPair(title)) {
        continue;
      }

      // Check if it's a valid forex pair or commodity
      if (!isForexOrCommodity(title)) {
        continue;
      }

      const symbol = normalizeDukascopySymbol(title);

      // Skip blocked symbols
      if (!symbol) continue;

      const key = symbol.replace(/[/_-]/g, '').toUpperCase();

      // Skip duplicates
      if (seen.has(key)) continue;
      seen.add(key);

      const longPercent = parseFloat(item.long);
      const shortPercent = parseFloat(item.short);

      // Validate percentages
      if (isNaN(longPercent) || isNaN(shortPercent)) continue;
      if (longPercent < 0 || longPercent > 100) continue;
      if (shortPercent < 0 || shortPercent > 100) continue;

      parsedData.push({
        symbol,
        longPercent: Math.round(longPercent * 100) / 100,
        shortPercent: Math.round(shortPercent * 100) / 100,
      });
    }

    if (parsedData.length === 0) {
      logger.warn('Dukascopy: No forex/commodity data found after filtering');
      return {
        success: false,
        source: 'dukascopy',
        data: [],
        error: 'No forex/commodity sentiment data found',
        timestamp,
      };
    }

    logger.info(`Dukascopy scraped ${parsedData.length} forex/commodity instruments`);

    return {
      success: true,
      source: 'dukascopy',
      data: parsedData,
      timestamp,
    };
  } catch (error) {
    logger.error('Dukascopy scraper error:', error);

    return {
      success: false,
      source: 'dukascopy',
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp,
    };
  }
}

// Check if the title represents a forex pair or commodity we care about
function isForexOrCommodity(title: string): boolean {
  // Common forex currencies
  const currencies = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD', 'CNH', 'HKD', 'SGD', 'NOK', 'SEK', 'DKK', 'PLN', 'TRY', 'MXN', 'ZAR', 'RUB', 'HUF', 'CZK', 'ILS', 'THB', 'RON'];

  // Commodities
  const commodities = ['XAU', 'XAG', 'GOLD', 'SILVER'];

  const upper = title.toUpperCase();

  // Check for commodities
  for (const commodity of commodities) {
    if (upper.includes(commodity)) return true;
  }

  // Check for forex pairs (should have format XXX/YYY where both are currencies)
  const parts = upper.replace(/[_-]/g, '/').split('/');
  if (parts.length === 2) {
    const [base, quote] = parts;
    if (currencies.includes(base) && currencies.includes(quote)) {
      return true;
    }
  }

  return false;
}

// Check if it's a currency pair (not a stock or crypto)
function isCurrencyPair(title: string): boolean {
  const currencies = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD', 'CNH', 'HKD', 'SGD', 'NOK', 'SEK', 'DKK', 'PLN', 'TRY', 'MXN', 'ZAR', 'RUB', 'HUF', 'CZK', 'ILS', 'THB', 'RON', 'XAU', 'XAG'];

  const upper = title.toUpperCase();
  const parts = upper.replace(/[_-]/g, '/').split('/');

  if (parts.length === 2) {
    return currencies.includes(parts[0]) && currencies.includes(parts[1]);
  }

  return false;
}

// Re-export for backwards compatibility with Puppeteer-based approach if needed
export { getAssetClass };
