import { ScraperResult } from '@/types';
import { logger, RateLimiter, SimpleCache } from '@/lib/utils';
import { CACHE } from '@/lib/constants';
import { saveSentimentData } from '@/services/sentiment.service';

// Rate limiter shared across all scrapers
const rateLimiter = new RateLimiter();

// Cache for scraper results
const scraperCache = new SimpleCache<ScraperResult>();

export type ScraperName = 'myfxbook' | 'oanda' | 'dukascopy' | 'forexfactory' | 'fxblue';

// Scraper function type
type ScraperFn = () => Promise<ScraperResult>;

// Dynamic scraper loader to avoid bundling Puppeteer
async function getScraperFn(name: ScraperName): Promise<ScraperFn> {
  switch (name) {
    case 'myfxbook':
      return (await import('./myfxbook')).scrapeMyfxbook;
    case 'oanda':
      return (await import('./oanda')).scrapeOanda;
    case 'dukascopy':
      return (await import('./dukascopy')).scrapeDukascopy;
    case 'forexfactory':
      return (await import('./forexfactory')).scrapeForexFactory;
    case 'fxblue':
      return (await import('./fxblue')).scrapeFxblue;
  }
}

const scraperNames: ScraperName[] = ['myfxbook', 'oanda', 'dukascopy', 'forexfactory', 'fxblue'];

// Run a single scraper with rate limiting and caching
export async function runScraper(name: ScraperName): Promise<ScraperResult> {
  // Check rate limit
  if (!rateLimiter.canCall(name, CACHE.SCRAPE_COOLDOWN_MS)) {
    const waitTime = rateLimiter.getTimeUntilReady(name, CACHE.SCRAPE_COOLDOWN_MS);
    logger.warn(`Rate limited: ${name}. Wait ${Math.ceil(waitTime / 1000)}s`);

    // Return cached result if available
    const cached = scraperCache.get(name);
    if (cached) {
      return cached;
    }

    return {
      success: false,
      source: name,
      data: [],
      error: `Rate limited. Try again in ${Math.ceil(waitTime / 1000)} seconds.`,
      timestamp: new Date(),
    };
  }

  // Record the call
  rateLimiter.record(name);

  try {
    logger.info(`Starting scraper: ${name}`);
    const scraperFn = await getScraperFn(name);
    const result = await scraperFn();

    // Cache successful results
    if (result.success) {
      scraperCache.set(name, result, CACHE.SCRAPE_COOLDOWN_MS);

      // Save to database
      const savedCount = await saveSentimentData(name, result.data);
      logger.info(`Saved ${savedCount} sentiment records from ${name}`);
    }

    return result;
  } catch (error) {
    logger.error(`Scraper ${name} failed:`, error);
    return {
      success: false,
      source: name,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    };
  }
}

// Run all scrapers
export async function runAllScrapers(): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];

  for (const name of scraperNames) {
    const result = await runScraper(name);
    results.push(result);
  }

  return results;
}

// Get scraper status
export function getScraperStatus(): Record<ScraperName, { canRun: boolean; waitTime: number }> {
  const status: Record<ScraperName, { canRun: boolean; waitTime: number }> = {} as Record<
    ScraperName,
    { canRun: boolean; waitTime: number }
  >;

  for (const name of scraperNames) {
    const canRun = rateLimiter.canCall(name, CACHE.SCRAPE_COOLDOWN_MS);
    const waitTime = rateLimiter.getTimeUntilReady(name, CACHE.SCRAPE_COOLDOWN_MS);
    status[name] = { canRun, waitTime };
  }

  return status;
}
