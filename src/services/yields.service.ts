/**
 * Yields Service - 2-Year Government Bond Yield Differentials
 *
 * Data Sources:
 * - USD: FRED API (DGS2)
 * - Others: Trading Economics (scraped)
 *
 * Scoring Logic:
 * - Calculate yield differential vs USD: Diff = Y_2Y_currency - Y_2Y_USD
 * - MA20 > MA60 of diff -> +1 (positive for currency)
 * - MA20 < MA60 of diff -> -1 (negative for currency)
 * - Otherwise -> 0 (neutral)
 */

import { prisma } from '@/lib/prisma';

// Use require for puppeteer-extra to avoid TypeScript issues
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// Trading Economics 2-Year Bond Yield URLs
const YIELD_URLS: Record<string, string> = {
  EUR: 'https://tradingeconomics.com/germany/2-year-note-yield',
  GBP: 'https://tradingeconomics.com/united-kingdom/2-year-note-yield',
  JPY: 'https://tradingeconomics.com/japan/2-year-note-yield',
  CHF: 'https://tradingeconomics.com/switzerland/2-year-note-yield',
  AUD: 'https://tradingeconomics.com/australia/2-year-note-yield',
  NZD: 'https://tradingeconomics.com/new-zealand/2-year-note-yield',
  CAD: 'https://tradingeconomics.com/canada/2-year-note-yield',
};

interface YieldDataPoint {
  currency: string;
  yield2Y: number;
  date: Date;
}

/**
 * Launch Puppeteer browser with stealth
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
 * Scrape 2Y yield from Trading Economics for a single currency
 */
async function scrapeYield(
  page: any,
  currency: string,
  url: string
): Promise<YieldDataPoint | null> {
  try {
    console.log(`[Yields] Scraping ${currency} 2Y yield from ${url}...`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait longer for JavaScript content to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    const data = await page.evaluate(() => {
      // Try to find the yield value from the page
      // Based on screenshot: "Germany 2 Year Bond Yield 2.123 0.007 (+0.0066%)"
      let yieldValue: string | null = null;

      // Method 1: Look for the chart title line with value
      // Pattern: "Germany 2 Year Bond Yield 2.123 0.007 (+0.0066%)"
      // Handle negative yields like "-0.35"
      const bodyText = document.body.innerText;

      // Look for pattern: "Year Bond Yield X.XXX" or "Year Note Yield X.XXX"
      // Allow negative values for CHF
      const titlePattern = bodyText.match(/(?:Year Bond Yield|Year Note Yield)\s+(-?\d+\.?\d{0,3})\s+/i);
      if (titlePattern) {
        const val = parseFloat(titlePattern[1]);
        if (val >= -3 && val <= 12) {  // Expanded range for negative yields
          yieldValue = titlePattern[1];
        }
      }

      // Method 2: Look for the pattern in element with the title
      if (!yieldValue) {
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          const text = el.textContent?.trim() || '';
          // Match: "2 Year Bond Yield 2.123" or similar
          const match = text.match(/2\s*Year.*?Yield\s+(-?\d+\.?\d{0,3})\b/i);
          if (match) {
            const val = parseFloat(match[1]);
            if (val >= -3 && val <= 12) {
              yieldValue = match[1];
              break;
            }
          }
        }
      }

      // Method 3: Look for "was X.XX percent" in description text
      if (!yieldValue) {
        const pattern = bodyText.match(/was\s+(-?\d+\.?\d{0,3})\s*percent/i);
        if (pattern) {
          const val = parseFloat(pattern[1]);
          if (val >= -3 && val <= 12) {
            yieldValue = pattern[1];
          }
        }
      }

      // Method 4: Look for standalone decimal numbers in yield range in prominent elements
      if (!yieldValue) {
        const prominentElements = document.querySelectorAll('h1, h2, h3, .value, [class*="value"], [class*="price"]');
        for (const el of prominentElements) {
          const text = el.textContent?.trim() || '';
          // Match decimal number like "2.123" or "-0.35"
          const match = text.match(/^(-?\d+\.\d{1,3})$/);
          if (match) {
            const val = parseFloat(match[1]);
            if (val >= -3 && val <= 12) {
              yieldValue = match[1];
              break;
            }
          }
        }
      }

      // Method 5: Find pattern "X.XXX X.XXX" which is common for price + change
      if (!yieldValue) {
        const pricePattern = bodyText.match(/\b(-?\d+\.\d{2,3})\s+(-?\d+\.\d{2,3})\s+\([+-]/);
        if (pricePattern) {
          const val = parseFloat(pricePattern[1]);
          if (val >= -3 && val <= 12) {
            yieldValue = pricePattern[1];
          }
        }
      }

      // Method 6: Look for number followed by percentage change pattern - broader match
      if (!yieldValue) {
        // Match patterns like "0.192 0.003 (+1.59%)" anywhere in page
        const broadPattern = bodyText.match(/\b(\d+\.\d{2,3})\s+[-+]?\d+\.\d+\s+\([+-]?\d+\.?\d*%\)/);
        if (broadPattern) {
          const val = parseFloat(broadPattern[1]);
          if (val >= 0 && val <= 12) {
            yieldValue = broadPattern[1];
          }
        }
      }

      return { yieldValue };
    });

    if (!data.yieldValue) {
      console.log(`[Yields] Could not find yield data for ${currency}`);
      return null;
    }

    const yield2Y = parseFloat(data.yieldValue);
    if (isNaN(yield2Y)) {
      console.log(`[Yields] Invalid yield value for ${currency}: ${data.yieldValue}`);
      return null;
    }

    console.log(`[Yields] ${currency}: ${yield2Y}%`);

    return {
      currency,
      yield2Y,
      date: new Date(),
    };
  } catch (error) {
    console.error(`[Yields] Error scraping ${currency}:`, error);
    return null;
  }
}

/**
 * Scrape international 2Y yields from Trading Economics
 */
export async function scrapeInternationalYields(): Promise<YieldDataPoint[]> {
  let browser = null;
  const results: YieldDataPoint[] = [];

  try {
    console.log('[Yields] Starting Trading Economics scrape for 2Y yields...');

    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    for (const [currency, url] of Object.entries(YIELD_URLS)) {
      const data = await scrapeYield(page, currency, url);
      if (data) {
        results.push(data);
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log(`[Yields] Total: ${results.length} yield data points`);
    return results;

  } catch (error) {
    console.error('[Yields] Scraper error:', error);
    return results;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Store yield data in database
 */
export async function updateYieldData(): Promise<{
  success: boolean;
  updated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let updated = 0;

  try {
    console.log('[Yields] Starting yield data update...');

    // Get international yields from Trading Economics
    const internationalYields = await scrapeInternationalYields();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const data of internationalYields) {
      try {
        await prisma.yieldData.upsert({
          where: {
            currency_date: { currency: data.currency, date: today },
          },
          update: { yield2Y: data.yield2Y },
          create: {
            currency: data.currency,
            date: today,
            yield2Y: data.yield2Y,
          },
        });
        updated++;
      } catch (error) {
        errors.push(`Failed to store ${data.currency} yield: ${error}`);
      }
    }

    console.log(`[Yields] Updated ${updated} yield data points`);
    return { success: true, updated, errors };

  } catch (error) {
    const msg = `Yield update failed: ${error instanceof Error ? error.message : 'Unknown'}`;
    errors.push(msg);
    console.error(`[Yields] ${msg}`);
    return { success: false, updated, errors };
  }
}

/**
 * Calculate yield differential and MA signals for all currencies
 */
export async function calculateYieldDifferentials(): Promise<{
  currency: string;
  yield2Y: number | null;
  differential: number | null;
  ma20: number | null;
  ma60: number | null;
  band: number; // volatility-scaled threshold
  signal: number; // +1, 0, -1
}[]> {
  const currencies = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD', 'USD'];
  const results: {
    currency: string;
    yield2Y: number | null;
    differential: number | null;
    ma20: number | null;
    ma60: number | null;
    band: number;
    signal: number;
  }[] = [];

  // Get last 60 days of yield data
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);

  const allYields = await prisma.yieldData.findMany({
    where: { date: { gte: cutoff } },
    orderBy: { date: 'desc' },
  });

  // Get USD yields for differential calculation
  const usdYields = allYields.filter(y => y.currency === 'USD');

  for (const currency of currencies) {
    const currencyYields = allYields.filter(y => y.currency === currency);

    if (currency === 'USD') {
      // USD has no differential vs itself
      results.push({
        currency,
        yield2Y: currencyYields[0]?.yield2Y || null,
        differential: 0,
        ma20: null,
        ma60: null,
        band: 0,
        signal: 0, // USD always neutral for yield diff
      });
      continue;
    }

    if (currencyYields.length === 0 || usdYields.length === 0) {
      results.push({
        currency,
        yield2Y: null,
        differential: null,
        ma20: null,
        ma60: null,
        band: 0.03,
        signal: 0,
      });
      continue;
    }

    // Calculate differentials for each day
    const differentials: number[] = [];
    for (const cy of currencyYields) {
      // Find matching USD yield for same date, or closest earlier date
      let uy = usdYields.find(u =>
        u.date.toISOString().split('T')[0] === cy.date.toISOString().split('T')[0]
      );
      // If no exact match, use the most recent USD yield
      if (!uy && usdYields.length > 0) {
        uy = usdYields[0]; // usdYields is sorted desc by date
      }
      if (uy) {
        differentials.push(cy.yield2Y - uy.yield2Y);
      }
    }

    const currentYield = currencyYields[0]?.yield2Y || null;
    // If we have a yield but no differential yet, calculate using latest USD
    const currentDiff = differentials[0] !== undefined
      ? differentials[0]
      : (currentYield !== null && usdYields.length > 0
          ? currentYield - usdYields[0].yield2Y
          : null);

    // Calculate MAs
    const ma20 = differentials.length >= 20
      ? differentials.slice(0, 20).reduce((a, b) => a + b, 0) / 20
      : null;

    const ma60 = differentials.length >= 60
      ? differentials.slice(0, 60).reduce((a, b) => a + b, 0) / 60
      : differentials.length >= 20
        ? differentials.reduce((a, b) => a + b, 0) / differentials.length
        : null;

    // Calculate volatility-scaled band for signal threshold
    // band = max(0.03, 0.25 * stdev) - adapts to each currency's typical movement
    let band = 0.03; // minimum 3 bps
    if (differentials.length >= 20) {
      const mean = differentials.slice(0, 60).reduce((a, b) => a + b, 0) / Math.min(differentials.length, 60);
      const squaredDiffs = differentials.slice(0, 60).map(d => Math.pow(d - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
      const stdev = Math.sqrt(variance);
      band = Math.max(0.03, 0.25 * stdev);
    }

    // Calculate signal using volatility-scaled band
    let signal = 0;
    if (ma20 !== null && ma60 !== null) {
      if (ma20 > ma60 + band) signal = 1;  // Improving vs USD
      else if (ma20 < ma60 - band) signal = -1;  // Deteriorating vs USD
    }

    results.push({
      currency,
      yield2Y: currentYield,
      differential: currentDiff,
      ma20,
      ma60,
      band,
      signal,
    });
  }

  return results;
}

/**
 * Update FundamentalCurrency with yield differential data
 */
export async function applyYieldDifferentials(): Promise<number> {
  const diffs = await calculateYieldDifferentials();
  let updated = 0;

  for (const diff of diffs) {
    try {
      // Map signal to rate differential string
      let rateDifferential = 'Flat';
      if (diff.signal === 1) rateDifferential = 'Positive';
      else if (diff.signal === -1) rateDifferential = 'Negative';

      await prisma.fundamentalCurrency.update({
        where: { currency: diff.currency },
        data: {
          yield2Y: diff.yield2Y,
          yieldDiffVsUsd: diff.differential,
          yieldDiffMa20: diff.ma20,
          yieldDiffMa60: diff.ma60,
          rateDifferential,
          lastUpdated: new Date(),
        },
      });
      updated++;
    } catch (error) {
      console.error(`[Yields] Failed to update ${diff.currency}:`, error);
    }
  }

  console.log(`[Yields] Applied yield differentials to ${updated} currencies`);
  return updated;
}

/**
 * Get yield data for charting
 * Returns aligned arrays with null for missing data points
 */
export async function getYieldChartData(days: number = 90): Promise<{
  dates: string[];
  currencies: Record<string, (number | null)[]>;
  differentials: Record<string, (number | null)[]>;
  ma20: Record<string, (number | null)[]>;
  ma60: Record<string, (number | null)[]>;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const yields = await prisma.yieldData.findMany({
    where: { date: { gte: cutoff } },
    orderBy: { date: 'asc' },
  });

  // Get unique dates from all yield data
  const dateSet = new Set(yields.map(y => y.date.toISOString().split('T')[0]));
  const sortedDates = Array.from(dateSet).sort();

  // All currencies we want to track
  const allCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD'];

  // Initialize arrays with nulls for all dates
  const currencies: Record<string, (number | null)[]> = {};
  const differentials: Record<string, (number | null)[]> = {};
  const ma20: Record<string, (number | null)[]> = {};
  const ma60: Record<string, (number | null)[]> = {};
  for (const currency of allCurrencies) {
    currencies[currency] = new Array(sortedDates.length).fill(null);
    differentials[currency] = new Array(sortedDates.length).fill(null);
    ma20[currency] = new Array(sortedDates.length).fill(null);
    ma60[currency] = new Array(sortedDates.length).fill(null);
  }

  // Create lookup map for quick access
  const yieldMap = new Map<string, number>();
  for (const y of yields) {
    const key = `${y.currency}:${y.date.toISOString().split('T')[0]}`;
    yieldMap.set(key, y.yield2Y);
  }

  // Fill in actual values
  for (let i = 0; i < sortedDates.length; i++) {
    const dateStr = sortedDates[i];
    const usdYield = yieldMap.get(`USD:${dateStr}`);

    for (const currency of allCurrencies) {
      const yieldValue = yieldMap.get(`${currency}:${dateStr}`);
      if (yieldValue !== undefined) {
        currencies[currency][i] = yieldValue;
        // Calculate differential vs USD (if USD available for that date)
        if (currency === 'USD') {
          differentials[currency][i] = 0;
        } else if (usdYield !== undefined) {
          differentials[currency][i] = yieldValue - usdYield;
        }
      }
    }
  }

  // Calculate rolling MAs for differentials
  for (const currency of allCurrencies) {
    if (currency === 'USD') continue; // Skip USD (always 0)

    for (let i = 0; i < sortedDates.length; i++) {
      // Collect non-null values up to this point
      const availableValues: number[] = [];
      for (let j = 0; j <= i; j++) {
        const val = differentials[currency][j];
        if (val !== null) {
          availableValues.push(val);
        }
      }

      // Calculate MA20 (use available data up to 20 points)
      if (availableValues.length >= 5) {
        const windowSize20 = Math.min(availableValues.length, 20);
        const slice20 = availableValues.slice(-windowSize20);
        ma20[currency][i] = slice20.reduce((a, b) => a + b, 0) / slice20.length;
      }

      // Calculate MA60 (use available data up to 60 points)
      if (availableValues.length >= 10) {
        const windowSize60 = Math.min(availableValues.length, 60);
        const slice60 = availableValues.slice(-windowSize60);
        ma60[currency][i] = slice60.reduce((a, b) => a + b, 0) / slice60.length;
      }
    }
  }

  return { dates: sortedDates, currencies, differentials, ma20, ma60 };
}
