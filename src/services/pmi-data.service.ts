/**
 * PMI Data Service - Trading Economics Scraper
 * Fetches Services PMI data for fundamental analysis
 * Source: tradingeconomics.com
 */

import { prisma } from '@/lib/prisma';

// Use require for puppeteer-extra to avoid TypeScript issues
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to bypass anti-bot measures
puppeteer.use(StealthPlugin());

// Currency to Trading Economics Services PMI URL mapping
const CURRENCY_URLS: Record<string, string> = {
  USD: 'https://tradingeconomics.com/united-states/services-pmi',
  EUR: 'https://tradingeconomics.com/euro-area/services-pmi',
  GBP: 'https://tradingeconomics.com/united-kingdom/services-pmi',
  JPY: 'https://tradingeconomics.com/japan/services-pmi',
  CAD: 'https://tradingeconomics.com/canada/services-pmi',
  AUD: 'https://tradingeconomics.com/australia/services-pmi',
  NZD: 'https://tradingeconomics.com/new-zealand/services-pmi',
  CHF: 'https://tradingeconomics.com/switzerland/services-pmi',
};

interface PmiDataPoint {
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
 * Scrape Services PMI data from Trading Economics for a single currency
 */
async function scrapeCurrencyPmi(
  page: any,
  currency: string,
  url: string
): Promise<PmiDataPoint | null> {
  try {
    console.log(`[PMI] Scraping ${currency} from ${url}...`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract data from the page - use text parsing (PMI isn't in the Related table)
    const data = await page.evaluate(() => {
      let actual: string | null = null;
      let previous: string | null = null;

      const bodyText = document.body.innerText;

      // Trading Economics shows PMI values in the summary description like:
      // "PMI fell to 44.3 in November from 50.5 in October"
      // "PMI decreased to 45.30 points in November from 47.80 points in October of 2025"
      // "PMI fell to 52.5 in December 2025 from a final 53.2 in the previous month"

      // Pattern 1: "to X.X [points] in Month [Year/of Year] from [a] [final/revised] Y.Y"
      // Handles optional "a", "final", "revised", "preliminary" between "from" and the number
      const patternFromTo = bodyText.match(/(?:to|at)\s+(\d+\.?\d*)(?:\s+points)?\s+in\s+\w+(?:\s+\d{4}|\s+of\s+\d{4})?\s+(?:from|compared to)(?:\s+a)?(?:\s+(?:final|revised|preliminary))?\s+(\d+\.?\d*)/i);
      if (patternFromTo) {
        actual = patternFromTo[1];
        previous = patternFromTo[2];
      }

      // Pattern 2: "unchanged from [Month]" - previous = actual
      if (actual && !previous) {
        if (bodyText.match(/unchanged\s+from\s+\w+/i) || bodyText.match(/consecutive/i)) {
          previous = actual;
        }
      }

      // Pattern 3: Fallback - look for PMI value in text
      if (!actual) {
        const rosePattern = bodyText.match(/(?:rose|fell|increased|decreased|climbed|dropped|edged)\s+(?:up\s+|down\s+)?(?:to\s+)?(\d+\.?\d*)(?:\s+points)?/i);
        if (rosePattern) {
          actual = rosePattern[1];
        }
      }

      return { actual, previous };
    });

    if (!data.actual) {
      console.log(`[PMI] Could not find PMI data for ${currency}`);
      return null;
    }

    const actual = parseFloat(data.actual?.replace(/[^\d.-]/g, '') || '') || null;
    const previous = parseFloat(data.previous?.replace(/[^\d.-]/g, '') || '') || null;

    console.log(`[PMI] ${currency}: actual=${actual}, previous=${previous}`);

    return {
      currency,
      actual,
      previous,
      date: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[PMI] Error scraping ${currency}:`, error);
    return null;
  }
}

/**
 * Scrape Services PMI data from Trading Economics for all currencies
 */
async function scrapePmiData(): Promise<PmiDataPoint[]> {
  let browser = null;
  const results: PmiDataPoint[] = [];

  try {
    console.log('[PMI] Starting Trading Economics scrape for Services PMI data...');

    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Scrape each currency
    for (const [currency, url] of Object.entries(CURRENCY_URLS)) {
      const data = await scrapeCurrencyPmi(page, currency, url);
      if (data) {
        results.push(data);
      }

      // Small delay between requests to be polite
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log(`[PMI] Total: ${results.length} Services PMI data points from Trading Economics`);
    return results;

  } catch (error) {
    console.error('[PMI] Scraper error:', error);
    return results;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Calculate PMI trend for a currency
 * Rule: >50 and higher than last month = Up; <50 and lower = Down; otherwise Flat
 * - Up: PMI > 50 (expansion) AND improving from previous
 * - Down: PMI < 50 (contraction) AND worsening from previous
 * - Flat: everything else (expansion but slowing, contraction but improving, etc.)
 */
function calculatePmiTrend(
  actual: number | null,
  previous: number | null
): 'Up' | 'Flat' | 'Down' {
  if (actual === null || previous === null) return 'Flat';

  // Up: expanding (>50) AND improving
  if (actual > 50 && actual > previous) return 'Up';

  // Down: contracting (<50) AND worsening
  if (actual < 50 && actual < previous) return 'Down';

  // Everything else is Flat
  return 'Flat';
}

/**
 * Update PMI data in the database
 */
export async function updatePmiData(): Promise<{
  success: boolean;
  updated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let updated = 0;

  try {
    console.log('[PMI] Starting Services PMI data update from Trading Economics...');

    const pmiData = await scrapePmiData();

    if (pmiData.length === 0) {
      console.log('[PMI] No PMI data found');
      return { success: true, updated: 0, errors: [] };
    }

    // Update each currency
    for (const data of pmiData) {
      try {
        const trend = calculatePmiTrend(data.actual, data.previous);

        await prisma.fundamentalCurrency.update({
          where: { currency: data.currency },
          data: {
            pmiSignal: trend,
            pmiActual: data.actual,
            pmiPrevious: data.previous,
            lastUpdated: new Date(),
            updatedBy: 'TradingEconomics',
          },
        });

        updated++;
        console.log(`[PMI] Updated ${data.currency}: PMI=${data.actual} (prev: ${data.previous}), trend=${trend}`);
      } catch (error) {
        const msg = `Failed to update ${data.currency} PMI: ${error instanceof Error ? error.message : 'Unknown'}`;
        errors.push(msg);
        console.error(`[PMI] ${msg}`);
      }
    }

    console.log(`[PMI] Completed. Updated ${updated} currencies`);
    return { success: true, updated, errors };

  } catch (error) {
    const msg = `PMI update failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(msg);
    console.error(`[PMI] ${msg}`);
    return { success: false, updated, errors };
  }
}

/**
 * Manual fetch of PMI data (for testing/debugging)
 */
export async function fetchPmiDataRaw(): Promise<PmiDataPoint[]> {
  return scrapePmiData();
}
