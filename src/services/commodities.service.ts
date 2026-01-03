/**
 * Commodities Service - Commodity Tailwind Calculations
 *
 * Currency-Commodity Mappings:
 * - AUD: Iron Ore + Copper basket
 * - CAD: WTI Oil
 * - NZD: Dairy (GDT Price Index)
 * - EUR, GBP, JPY, CHF, USD: Always 0 (no commodity exposure)
 *
 * Scoring Logic:
 * - Commodity above 3M MA & rising -> +1
 * - Commodity below 3M MA & falling -> -1
 * - Otherwise -> 0
 */

import { prisma } from '@/lib/prisma';

// Use require for puppeteer-extra
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// Trading Economics commodity URLs
const COMMODITY_URLS: Record<string, string> = {
  IRON_ORE: 'https://tradingeconomics.com/commodity/iron-ore',
  COPPER: 'https://tradingeconomics.com/commodity/copper',
  DAIRY: 'https://tradingeconomics.com/commodity/milk',  // GDT Dairy
};

// Currency to commodity mappings
const CURRENCY_COMMODITIES: Record<string, string[]> = {
  AUD: ['IRON_ORE', 'COPPER'],  // Average basket
  CAD: ['OIL_WTI'],              // Already fetched via FRED
  NZD: ['DAIRY'],
};

interface CommodityDataPoint {
  commodity: string;
  price: number;
  date: Date;
}

/**
 * Launch Puppeteer browser
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
 * Scrape commodity price from Trading Economics
 */
async function scrapeCommodityPrice(
  page: any,
  commodity: string,
  url: string
): Promise<CommodityDataPoint | null> {
  try {
    console.log(`[Commodities] Scraping ${commodity} from ${url}...`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait longer for JavaScript content to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get commodity-specific price range for validation
    const priceRanges: Record<string, [number, number]> = {
      IRON_ORE: [50, 250],    // Iron ore typically $80-$150
      COPPER: [6000, 12000],  // Copper typically $8000-$10000
      DAIRY: [10, 30],        // Class III Milk typically $15-25 per cwt
    };
    const [minPrice, maxPrice] = priceRanges[commodity] || [1, 15000];

    const data = await page.evaluate((minP: number, maxP: number, commodityName: string) => {
      let priceValue: string | null = null;
      const bodyText = document.body.innerText;

      // Method 1: Look for pattern like "Iron Ore 104.50 -1.00 (-0.95%)"
      // The commodity name followed by the price
      const commodityPatterns: Record<string, RegExp[]> = {
        IRON_ORE: [
          /Iron\s*Ore\s+(\d+\.?\d*)\s+/i,
          /62%\s*Fe.*?(\d+\.?\d*)\s+/i,
        ],
        COPPER: [
          /Copper\s+(\d{1,2},?\d{3}\.?\d*)\s+/i,  // Matches "8,965.50" or "8965.50"
          /Copper\s+(\d+\.?\d*)\s+[-+]?\d/i,       // Matches "8965 -50"
        ],
        DAIRY: [
          /Milk\s+(\d+\.?\d*)\s+[-+]?\d/i,         // Matches "19.85 -0.05"
          /Class\s+III\s+Milk\s+(\d+\.?\d*)\s+/i,
          /Class\s+III\s+(\d+\.?\d*)\s+/i,
        ],
      };

      const patterns = commodityPatterns[commodityName] || [];
      for (const pattern of patterns) {
        const match = bodyText.match(pattern);
        if (match) {
          const val = parseFloat(match[1].replace(/,/g, ''));
          if (val >= minP && val <= maxP) {
            priceValue = match[1].replace(/,/g, '');
            break;
          }
        }
      }

      // Method 2: Look for "traded at XXX" pattern
      if (!priceValue) {
        const tradedPattern = bodyText.match(/traded\s+at\s+(\d+[\d,]*\.?\d*)/i);
        if (tradedPattern) {
          const val = parseFloat(tradedPattern[1].replace(/,/g, ''));
          if (val >= minP && val <= maxP) {
            priceValue = tradedPattern[1].replace(/,/g, '');
          }
        }
      }

      // Method 3: Look for "was X.XX USD" pattern
      if (!priceValue) {
        const wasPattern = bodyText.match(/was\s+(\d+[\d,]*\.?\d*)\s*(?:USD|usd)/i);
        if (wasPattern) {
          const val = parseFloat(wasPattern[1].replace(/,/g, ''));
          if (val >= minP && val <= maxP) {
            priceValue = wasPattern[1].replace(/,/g, '');
          }
        }
      }

      // Method 4: Find pattern "X.XX X.XX (+/-X.XX%)" - price followed by change
      if (!priceValue) {
        const priceChangePattern = bodyText.match(/\b(\d+[\d,]*\.?\d*)\s+(-?\d+\.?\d*)\s+\([+-]/);
        if (priceChangePattern) {
          const val = parseFloat(priceChangePattern[1].replace(/,/g, ''));
          if (val >= minP && val <= maxP) {
            priceValue = priceChangePattern[1].replace(/,/g, '');
          }
        }
      }

      // Method 5: Look for any number in the expected range near the beginning of page
      if (!priceValue) {
        // Match numbers in reasonable commodity price format
        const allNumbers = bodyText.match(/\b(\d{1,2},?\d{3}\.?\d{0,2})\b/g) || [];
        for (const numStr of allNumbers.slice(0, 10)) { // Check first 10 numbers
          const val = parseFloat(numStr.replace(/,/g, ''));
          if (val >= minP && val <= maxP) {
            priceValue = numStr.replace(/,/g, '');
            break;
          }
        }
      }

      // Method 6: For dairy specifically, look for smaller prices
      if (!priceValue && commodityName === 'DAIRY') {
        const dairyPattern = bodyText.match(/(\d{1,2}\.\d{2})\s+[-+]?\d/);
        if (dairyPattern) {
          const val = parseFloat(dairyPattern[1]);
          if (val >= 10 && val <= 30) { // Class III milk typically $15-25
            priceValue = dairyPattern[1];
          }
        }
      }

      return { priceValue };
    }, minPrice, maxPrice, commodity);

    if (!data.priceValue) {
      console.log(`[Commodities] Could not find price for ${commodity}`);
      return null;
    }

    const price = parseFloat(data.priceValue);
    if (isNaN(price)) {
      console.log(`[Commodities] Invalid price for ${commodity}: ${data.priceValue}`);
      return null;
    }

    console.log(`[Commodities] ${commodity}: $${price}`);

    return {
      commodity,
      price,
      date: new Date(),
    };
  } catch (error) {
    console.error(`[Commodities] Error scraping ${commodity}:`, error);
    return null;
  }
}

/**
 * Scrape all commodity prices from Trading Economics
 */
export async function scrapeCommodityPrices(): Promise<CommodityDataPoint[]> {
  let browser = null;
  const results: CommodityDataPoint[] = [];

  try {
    console.log('[Commodities] Starting commodity price scrape...');

    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    for (const [commodity, url] of Object.entries(COMMODITY_URLS)) {
      const data = await scrapeCommodityPrice(page, commodity, url);
      if (data) {
        results.push(data);
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log(`[Commodities] Total: ${results.length} commodity prices`);
    return results;

  } catch (error) {
    console.error('[Commodities] Scraper error:', error);
    return results;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Update commodity data in database
 */
export async function updateCommodityData(): Promise<{
  success: boolean;
  updated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let updated = 0;

  try {
    console.log('[Commodities] Starting commodity data update...');

    const commodityPrices = await scrapeCommodityPrices();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const data of commodityPrices) {
      try {
        await prisma.commodityData.upsert({
          where: {
            commodity_date: { commodity: data.commodity, date: today },
          },
          update: { price: data.price },
          create: {
            commodity: data.commodity,
            date: today,
            price: data.price,
          },
        });
        updated++;
      } catch (error) {
        errors.push(`Failed to store ${data.commodity}: ${error}`);
      }
    }

    console.log(`[Commodities] Updated ${updated} commodity prices`);
    return { success: true, updated, errors };

  } catch (error) {
    const msg = `Commodity update failed: ${error instanceof Error ? error.message : 'Unknown'}`;
    errors.push(msg);
    console.error(`[Commodities] ${msg}`);
    return { success: false, updated, errors };
  }
}

/**
 * Calculate commodity tailwind signal for a currency
 */
async function calculateCommoditySignal(currency: string): Promise<{
  signal: number;
  basketValue: number | null;
  ma90: number | null;
  trend: 'rising' | 'falling' | 'flat';
}> {
  const commodities = CURRENCY_COMMODITIES[currency];

  if (!commodities || commodities.length === 0) {
    return { signal: 0, basketValue: null, ma90: null, trend: 'flat' };
  }

  // Get last 90 days of data
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  // Calculate basket value for each day
  const basketByDay: Map<string, { sum: number; count: number }> = new Map();

  for (const commodity of commodities) {
    const prices = await prisma.commodityData.findMany({
      where: {
        commodity,
        date: { gte: cutoff },
      },
      orderBy: { date: 'desc' },
    });

    for (const p of prices) {
      const dateKey = p.date.toISOString().split('T')[0];
      const existing = basketByDay.get(dateKey) || { sum: 0, count: 0 };
      basketByDay.set(dateKey, {
        sum: existing.sum + p.price,
        count: existing.count + 1,
      });
    }
  }

  // Convert to normalized basket values (average of commodities)
  const basketValues: { date: string; value: number }[] = [];
  for (const [date, data] of basketByDay.entries()) {
    if (data.count === commodities.length) {
      basketValues.push({
        date,
        value: data.sum / data.count,
      });
    }
  }

  // Sort by date descending
  basketValues.sort((a, b) => b.date.localeCompare(a.date));

  if (basketValues.length === 0) {
    return { signal: 0, basketValue: null, ma90: null, trend: 'flat' };
  }

  const currentValue = basketValues[0].value;
  const ma90 = basketValues.reduce((sum, v) => sum + v.value, 0) / basketValues.length;

  // Determine trend (compare recent 20-day avg vs previous 20-day avg)
  let trend: 'rising' | 'falling' | 'flat' = 'flat';
  if (basketValues.length >= 40) {
    const recent20 = basketValues.slice(0, 20);
    const older20 = basketValues.slice(20, 40);

    const recentAvg = recent20.reduce((sum, v) => sum + v.value, 0) / 20;
    const olderAvg = older20.reduce((sum, v) => sum + v.value, 0) / 20;

    if (recentAvg > olderAvg * 1.02) trend = 'rising';
    else if (recentAvg < olderAvg * 0.98) trend = 'falling';
  }

  // Calculate signal
  let signal = 0;
  if (currentValue > ma90 && trend === 'rising') signal = 1;
  else if (currentValue < ma90 && trend === 'falling') signal = -1;

  return { signal, basketValue: currentValue, ma90, trend };
}

/**
 * Apply commodity tailwinds to all currencies
 */
export async function applyCommodityTailwinds(): Promise<number> {
  const currencies = ['AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'JPY', 'NZD', 'USD'];
  let updated = 0;

  for (const currency of currencies) {
    const result = await calculateCommoditySignal(currency);

    // Map signal to string
    let commodityTailwind = 'Neutral';
    if (result.signal === 1) commodityTailwind = 'Yes';
    else if (result.signal === -1) commodityTailwind = 'No';

    try {
      await prisma.fundamentalCurrency.update({
        where: { currency },
        data: {
          commodityTailwind,
          commodityBasket: result.basketValue,
          commodityMa90: result.ma90,
          commodityAdj: result.signal,
          lastUpdated: new Date(),
        },
      });
      updated++;
    } catch (error) {
      console.error(`[Commodities] Failed to update ${currency}:`, error);
    }
  }

  console.log(`[Commodities] Applied commodity tailwinds to ${updated} currencies`);
  return updated;
}

/**
 * Get commodity chart data
 * Returns aligned arrays with null for missing data points
 */
export async function getCommodityChartData(days: number = 90): Promise<{
  dates: string[];
  commodities: Record<string, (number | null)[]>;
  ma90: Record<string, (number | null)[]>;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const commodityData = await prisma.commodityData.findMany({
    where: { date: { gte: cutoff } },
    orderBy: { date: 'asc' },
  });

  // Get unique dates
  const dateSet = new Set(commodityData.map(c => c.date.toISOString().split('T')[0]));
  const sortedDates = Array.from(dateSet).sort();

  // All commodities we want to track
  const commodityNames = ['IRON_ORE', 'COPPER', 'OIL_WTI', 'DAIRY'];

  // Initialize arrays with nulls for all dates
  const commodities: Record<string, (number | null)[]> = {};
  const ma90: Record<string, (number | null)[]> = {};
  for (const name of commodityNames) {
    commodities[name] = new Array(sortedDates.length).fill(null);
    ma90[name] = new Array(sortedDates.length).fill(null);
  }

  // Create lookup map for quick access
  const priceMap = new Map<string, number>();
  for (const c of commodityData) {
    const key = `${c.commodity}:${c.date.toISOString().split('T')[0]}`;
    priceMap.set(key, c.price);
  }

  // Fill in actual values and calculate rolling MA
  for (const name of commodityNames) {
    const historicalPrices: number[] = [];

    for (let i = 0; i < sortedDates.length; i++) {
      const dateStr = sortedDates[i];
      const price = priceMap.get(`${name}:${dateStr}`);

      if (price !== undefined) {
        commodities[name][i] = price;
        historicalPrices.push(price);

        // Calculate rolling MA from available data
        const maWindow = Math.min(historicalPrices.length, 90);
        const maValue = historicalPrices.slice(-maWindow).reduce((a, b) => a + b, 0) / maWindow;
        ma90[name][i] = maValue;
      }
    }
  }

  return { dates: sortedDates, commodities, ma90 };
}
