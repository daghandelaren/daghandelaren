/**
 * Economic Data Service - Trading Economics Scraper
 * Fetches Core CPI/Inflation data for fundamental analysis
 * Source: tradingeconomics.com
 */

import { prisma } from '@/lib/prisma';

// Use require for puppeteer-extra to avoid TypeScript issues
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to bypass anti-bot measures
puppeteer.use(StealthPlugin());

// Currency to Trading Economics country mapping
const CURRENCY_URLS: Record<string, string> = {
  USD: 'https://tradingeconomics.com/united-states/core-inflation-rate',
  EUR: 'https://tradingeconomics.com/euro-area/core-inflation-rate',
  GBP: 'https://tradingeconomics.com/united-kingdom/core-inflation-rate',
  JPY: 'https://tradingeconomics.com/japan/core-inflation-rate',
  CAD: 'https://tradingeconomics.com/canada/core-inflation-rate',
  AUD: 'https://tradingeconomics.com/australia/core-inflation-rate',
  NZD: 'https://tradingeconomics.com/new-zealand/core-inflation-rate',
  CHF: 'https://tradingeconomics.com/switzerland/core-inflation-rate',
};

interface CpiDataPoint {
  currency: string;
  actual: number | null;
  previous: number | null;
  date: string;
}

/**
 * Launch a Puppeteer browser instance with stealth
 */
async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  });
}

/**
 * Scrape Core CPI data from Trading Economics for a single currency
 */
async function scrapeCurrencyCpi(
  page: any,
  currency: string,
  url: string
): Promise<CpiDataPoint | null> {
  try {
    console.log(`[CPI] Scraping ${currency} from ${url}...`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract data from the page - prioritize table extraction (more reliable)
    const data = await page.evaluate(() => {
      let actual: string | null = null;
      let previous: string | null = null;

      // PRIMARY METHOD: Extract from the Related table (most reliable)
      // Table has columns: Related | Last | Previous | Unit | Reference
      // Look for rows like "Core Inflation Rate YoY", "RBA Trimmed Mean CPI YoY"
      const tableRows = document.querySelectorAll('table tr');
      for (const row of tableRows) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          const rowText = cells[0]?.textContent?.trim().toLowerCase() || '';
          if (rowText.includes('core inflation rate') ||
              rowText.includes('trimmed mean cpi') ||
              rowText.includes('core cpi')) {
            const lastVal = cells[1]?.textContent?.trim().replace(/[^\d.-]/g, '');
            const prevVal = cells[2]?.textContent?.trim().replace(/[^\d.-]/g, '');
            if (lastVal) actual = lastVal;
            if (prevVal) previous = prevVal;
            break;
          }
        }
      }

      // FALLBACK: Parse from text description if table extraction failed
      if (!actual || !previous) {
        const bodyText = document.body.innerText;

        // Pattern: "to X.X% in Month [Year] from Y.Y%"
        if (!actual || !previous) {
          const patternFromTo = bodyText.match(/(?:to|at)\s+(\d+\.?\d*)%?\s+in\s+\w+(?:\s+\d{4}|\s+of\s+\d{4})?\s+(?:from|compared to)\s+(\d+\.?\d*)/i);
          if (patternFromTo) {
            if (!actual) actual = patternFromTo[1];
            if (!previous) previous = patternFromTo[2];
          }
        }

        // Pattern: "rose by X.X% ... up from Y.Y%"
        if (!actual || !previous) {
          const upDownPattern = bodyText.match(/(?:rose|increased|climbed)\s+(?:by\s+)?(\d+\.?\d*)%[^.]*?(?:up|from)\s+(?:from\s+)?(\d+\.?\d*)/i);
          if (upDownPattern) {
            if (!actual) actual = upDownPattern[1];
            if (!previous) previous = upDownPattern[2];
          }
        }

        // Pattern: "unchanged from [Month]" - previous = actual
        if (actual && !previous) {
          if (bodyText.match(/unchanged\s+from\s+\w+/i) || bodyText.match(/consecutive/i)) {
            previous = actual;
          }
        }
      }

      return { actual, previous };
    });

    if (!data.actual) {
      console.log(`[CPI] Could not find CPI data for ${currency}`);
      return null;
    }

    const actual = parseFloat(data.actual?.replace(/[^\d.-]/g, '') || '') || null;
    const previous = parseFloat(data.previous?.replace(/[^\d.-]/g, '') || '') || null;

    console.log(`[CPI] ${currency}: actual=${actual}, previous=${previous}`);

    return {
      currency,
      actual,
      previous,
      date: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[CPI] Error scraping ${currency}:`, error);
    return null;
  }
}

/**
 * Scrape Core CPI data from Trading Economics for all currencies
 */
async function scrapeCpiData(): Promise<CpiDataPoint[]> {
  let browser = null;
  const results: CpiDataPoint[] = [];

  try {
    console.log('[CPI] Starting Trading Economics scrape for Core CPI data...');

    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Scrape each currency
    for (const [currency, url] of Object.entries(CURRENCY_URLS)) {
      const data = await scrapeCurrencyCpi(page, currency, url);
      if (data) {
        results.push(data);
      }

      // Small delay between requests to be polite
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log(`[CPI] Total: ${results.length} Core CPI data points from Trading Economics`);
    return results;

  } catch (error) {
    console.error('[CPI] Scraper error:', error);
    return results;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Calculate inflation trend from CPI data
 * Compares latest release vs previous release
 * Up = latest > previous, Down = latest < previous, Flat = same
 */
function calculateInflationTrend(
  actual: number | null,
  previous: number | null
): 'Up' | 'Flat' | 'Down' {
  if (actual === null || previous === null) return 'Flat';

  // Compare latest vs previous - threshold of 0.1% for significant change
  if (actual > previous + 0.05) return 'Up';
  if (actual < previous - 0.05) return 'Down';
  return 'Flat';
}

/**
 * Update CPI/inflation data in the database
 */
export async function updateEconomicData(): Promise<{
  success: boolean;
  updated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let updated = 0;

  try {
    console.log('[Economic Data] Starting Core CPI data update from Trading Economics...');

    const cpiData = await scrapeCpiData();

    if (cpiData.length === 0) {
      console.log('[Economic Data] No CPI data found');
      return { success: true, updated: 0, errors: [] };
    }

    // Update each currency
    for (const data of cpiData) {
      try {
        const trend = calculateInflationTrend(data.actual, data.previous);

        await prisma.fundamentalCurrency.update({
          where: { currency: data.currency },
          data: {
            inflationTrend: trend,
            cpiActual: data.actual,
            cpiPrevious: data.previous,
            lastUpdated: new Date(),
            updatedBy: 'TradingEconomics',
          },
        });

        updated++;
        console.log(`[Economic Data] Updated ${data.currency}: CPI=${data.actual}% (prev: ${data.previous}%), trend=${trend}`);
      } catch (error) {
        const msg = `Failed to update ${data.currency} CPI: ${error instanceof Error ? error.message : 'Unknown'}`;
        errors.push(msg);
        console.error(`[Economic Data] ${msg}`);
      }
    }

    console.log(`[Economic Data] Completed. Updated ${updated} currencies`);
    return { success: true, updated, errors };

  } catch (error) {
    const msg = `Economic data update failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(msg);
    console.error(`[Economic Data] ${msg}`);
    return { success: false, updated, errors };
  }
}

/**
 * Manual fetch of CPI data (for testing/debugging)
 */
export async function fetchCpiDataRaw(): Promise<CpiDataPoint[]> {
  return scrapeCpiData();
}

/**
 * Get status of economic data service
 */
export function getEconomicDataStatus(): {
  configured: boolean;
  source: string;
} {
  return {
    configured: true,
    source: 'TradingEconomics',
  };
}
