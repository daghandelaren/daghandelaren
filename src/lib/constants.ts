// Currency codes for forex pairs (ordered by standard forex priority: higher priority = base currency)
// EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY
export const CURRENCIES = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY'] as const;
export type Currency = (typeof CURRENCIES)[number];

// Currency priority for determining base/quote (higher number = higher priority = base currency)
export const CURRENCY_PRIORITY: Record<Currency, number> = {
  EUR: 8,
  GBP: 7,
  AUD: 6,
  NZD: 5,
  USD: 4,
  CAD: 3,
  CHF: 2,
  JPY: 1,
};

// Asset classes
export const ASSET_CLASSES = ['forex', 'commodity', 'index'] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

// Data sources
export const DATA_SOURCES = ['myfxbook', 'oanda', 'dukascopy'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

// Generate all forex pairs from currencies using standard market conventions
export function generateForexPairs(): Array<{ symbol: string; base: Currency; quote: Currency }> {
  const pairs: Array<{ symbol: string; base: Currency; quote: Currency }> = [];

  for (let i = 0; i < CURRENCIES.length; i++) {
    for (let j = i + 1; j < CURRENCIES.length; j++) {
      const curr1 = CURRENCIES[i];
      const curr2 = CURRENCIES[j];
      // Higher priority currency becomes base
      const base = CURRENCY_PRIORITY[curr1] > CURRENCY_PRIORITY[curr2] ? curr1 : curr2;
      const quote = base === curr1 ? curr2 : curr1;
      pairs.push({
        symbol: `${base}/${quote}`,
        base,
        quote,
      });
    }
  }

  return pairs;
}

// All 28 forex pairs
export const FOREX_PAIRS = generateForexPairs();

// Sentiment thresholds for coloring
export const SENTIMENT_THRESHOLDS = {
  STRONG_BULLISH: 20, // Net > 20%
  BULLISH: 5, // Net > 5%
  NEUTRAL: -5, // Net between -5% and 5%
  BEARISH: -20, // Net < -5%
  STRONG_BEARISH: -100, // Net < -20%
};

// Cache settings
export const CACHE = {
  SCRAPE_COOLDOWN_MS: 5 * 60 * 1000, // 5 minutes between scrapes per source
  SENTIMENT_STALE_MS: 60 * 60 * 1000, // Sentiment data considered stale after 1 hour
  CLEANUP_RETENTION_DAYS: 7, // Keep 7 days of historical data
};

// Scraper timeouts
export const SCRAPER = {
  TIMEOUT_MS: Number(process.env.SCRAPE_TIMEOUT_MS) || 30000,
  NAVIGATION_TIMEOUT_MS: 60000,
};
