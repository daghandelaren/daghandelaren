import { Browser, Page } from 'puppeteer';
import { ScraperResult } from '@/types';
import { logger } from '@/lib/utils';
import { parseForexFactoryData, ForexFactoryPosition } from './parsers/forexfactory.parser';

// Use require for puppeteer-extra to avoid TypeScript issues
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to bypass Cloudflare
puppeteer.use(StealthPlugin());

const FOREXFACTORY_TRADES_URL = 'https://www.forexfactory.com/trades';

/**
 * Launch a Puppeteer browser instance
 */
async function launchBrowser(): Promise<Browser> {
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
 * Extract positions data from the trades page (no login required)
 */
async function extractPositions(page: Page): Promise<ForexFactoryPosition[]> {
  try {
    logger.debug('Navigating to ForexFactory trades page');

    await page.goto(FOREXFACTORY_TRADES_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait for positions data to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extract positions data - ForexFactory shows "XX% YY Traders" format
    const positions = await page.evaluate(() => {
      const results: Array<{ symbol: string; tradersLong: number; tradersShort: number }> = [];
      const seen = new Set<string>();

      // Find all rows that contain position data
      // Format: "EUR/USD\n\t\n42% 68 Traders\n94 Traders 58%\n\tOpen"
      const rows = document.querySelectorAll('tr');

      for (const row of rows) {
        const text = row.innerText || '';

        // Look for forex pair or commodity patterns
        const pairMatch = text.match(/([A-Z]{3})\/([A-Z]{3})|Gold\/USD|Silver\/USD/i);
        if (!pairMatch) continue;

        let symbol = pairMatch[0];
        // Normalize Gold/Silver to XAU/XAG
        if (symbol.toLowerCase() === 'gold/usd') symbol = 'XAU/USD';
        if (symbol.toLowerCase() === 'silver/usd') symbol = 'XAG/USD';

        // Skip if already seen
        const key = symbol.replace('/', '').toUpperCase();
        if (seen.has(key)) continue;

        // Extract percentages - look for pattern like "51% 88 Traders" and "84 Traders 49%"
        // Long is first percentage, Short is second
        const percentMatches = text.match(/(\d+)%\s*\d+\s*Traders|\d+\s*Traders\s*(\d+)%/gi);

        if (percentMatches && percentMatches.length >= 2) {
          // First match is long percentage
          const longMatch = percentMatches[0].match(/(\d+)%/);
          // Second match is short percentage
          const shortMatch = percentMatches[1].match(/(\d+)%/);

          if (longMatch && shortMatch) {
            const longPercent = parseInt(longMatch[1], 10);
            const shortPercent = parseInt(shortMatch[1], 10);

            // Validate percentages
            if (longPercent >= 0 && longPercent <= 100 &&
                shortPercent >= 0 && shortPercent <= 100 &&
                Math.abs(longPercent + shortPercent - 100) <= 5) {
              seen.add(key);
              results.push({
                symbol,
                tradersLong: longPercent,
                tradersShort: shortPercent,
              });
            }
          }
        }
      }

      return results;
    });

    logger.debug(`Extracted ${positions.length} positions from ForexFactory`);
    return positions;

  } catch (error) {
    logger.error('Error extracting ForexFactory positions:', error);
    return [];
  }
}

/**
 * Main scraper function for ForexFactory
 * No login required - positions data is publicly accessible
 */
export async function scrapeForexFactory(): Promise<ScraperResult> {
  const timestamp = new Date();
  let browser: Browser | null = null;

  try {
    logger.debug('Starting ForexFactory scraper');

    browser = await launchBrowser();
    const page = await browser.newPage();

    // Set a realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Extract positions (no login needed)
    const rawPositions = await extractPositions(page);

    if (rawPositions.length === 0) {
      logger.warn('ForexFactory: No position data found');
      return {
        success: false,
        source: 'forexfactory',
        data: [],
        error: 'No position data found on ForexFactory trades page',
        timestamp,
      };
    }

    // Parse and normalize data
    const data = parseForexFactoryData(rawPositions);

    if (data.length === 0) {
      return {
        success: false,
        source: 'forexfactory',
        data: [],
        error: 'Failed to parse ForexFactory position data',
        timestamp,
      };
    }

    logger.info(`ForexFactory scraped ${data.length} instruments`);

    return {
      success: true,
      source: 'forexfactory',
      data,
      timestamp,
    };

  } catch (error) {
    logger.error('ForexFactory scraper error:', error);

    return {
      success: false,
      source: 'forexfactory',
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp,
    };

  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
