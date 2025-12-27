import { ScraperResult, ScrapedSentiment } from '@/types';
import { logger } from '@/lib/utils';
import { normalizeOandaSymbol } from './parsers/oanda.parser';

// OANDA GraphQL API endpoint
const OANDA_GRAPHQL_URL = 'https://labs-api.oanda.com/graphql';

// GraphQL query for sentiment data
const SENTIMENT_QUERY = `
query GetSentimentList($division: Division) {
  sentimentList(division: $division) {
    name
    displayName
    sentiment {
      shortPercent
      longPercent
    }
    updatedAt
  }
}
`;

interface OandaSentimentItem {
  name: string;
  displayName: string;
  sentiment: {
    shortPercent: number;
    longPercent: number;
  };
  updatedAt: string;
}

interface OandaGraphQLResponse {
  data?: {
    sentimentList: OandaSentimentItem[];
  };
  errors?: Array<{ message: string }>;
}

export async function scrapeOanda(): Promise<ScraperResult> {
  const timestamp = new Date();

  try {
    logger.debug('Fetching OANDA GraphQL sentiment API');

    const response = await fetch(OANDA_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'https://proptrader.oanda.com',
        'Referer': 'https://proptrader.oanda.com/',
      },
      body: JSON.stringify({
        operationName: 'GetSentimentList',
        variables: { division: 'OGM' },
        query: SENTIMENT_QUERY,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: OandaGraphQLResponse = await response.json();

    // Check for GraphQL errors
    if (result.errors && result.errors.length > 0) {
      const errorMsg = result.errors.map(e => e.message).join(', ');
      throw new Error(`GraphQL error: ${errorMsg}`);
    }

    const sentimentList = result.data?.sentimentList;

    if (!sentimentList || sentimentList.length === 0) {
      return {
        success: false,
        source: 'oanda',
        data: [],
        error: 'API returned empty or invalid data',
        timestamp,
      };
    }

    logger.debug(`OANDA API returned ${sentimentList.length} instruments`);

    // Parse and filter the data
    const parsedData: ScrapedSentiment[] = [];
    const seen = new Set<string>();

    for (const item of sentimentList) {
      const name = item.name || '';

      // Skip items we don't track
      if (!isSupportedInstrument(name)) {
        continue;
      }

      const symbol = normalizeOandaSymbol(name);

      // Skip blocked symbols
      if (!symbol) continue;

      const key = symbol.replace(/[/_-]/g, '').toUpperCase();

      // Skip duplicates
      if (seen.has(key)) continue;
      seen.add(key);

      const longPercent = item.sentiment?.longPercent;
      const shortPercent = item.sentiment?.shortPercent;

      // Validate percentages
      if (longPercent === undefined || shortPercent === undefined) continue;
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
      logger.warn('OANDA: No forex/commodity data found after filtering');
      return {
        success: false,
        source: 'oanda',
        data: [],
        error: 'No forex/commodity sentiment data found',
        timestamp,
      };
    }

    logger.info(`OANDA scraped ${parsedData.length} forex/commodity instruments`);

    return {
      success: true,
      source: 'oanda',
      data: parsedData,
      timestamp,
    };
  } catch (error) {
    logger.error('OANDA scraper error:', error);

    return {
      success: false,
      source: 'oanda',
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp,
    };
  }
}

// Check if the name represents a supported instrument (forex, commodity, index, crypto)
function isSupportedInstrument(name: string): boolean {
  const upper = name.toUpperCase();

  // Forex pairs (6 chars like EURUSD or with separator)
  const forexPattern = /^[A-Z]{6}$|^[A-Z]{3}[/_-][A-Z]{3}$/;
  if (forexPattern.test(upper)) {
    return true;
  }

  // Commodities
  const commodities = ['XAUUSD', 'XAGUSD', 'XAU/USD', 'XAG/USD', 'GOLD', 'SILVER'];
  if (commodities.includes(upper)) {
    return true;
  }

  // Indices
  const indices = ['US100', 'US500', 'US30', 'JP225', 'HK50', 'DE30', 'UK100'];
  if (indices.includes(upper)) {
    return true;
  }

  // Crypto
  const crypto = ['BTCUSD', 'ETHUSD', 'BTC/USD', 'ETH/USD', 'BITCOIN', 'ETHEREUM'];
  if (crypto.includes(upper)) {
    return true;
  }

  return false;
}
