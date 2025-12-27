import { Browser, Page, Frame } from 'puppeteer';
import { ScraperResult } from '@/types';
import { logger } from '@/lib/utils';
import { parseForexcomData, ForexcomPosition } from './parsers/forexcom.parser';

// Use require for puppeteer-extra to avoid TypeScript issues
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to bypass Cloudflare
puppeteer.use(StealthPlugin());

// Try both Forex.com and FXBlue directly
const URLS = [
  'https://www.forex.com/en-us/trading-tools/client-sentiment/',
  'https://www.fxblue.com/market-data/tools/sentiment',
];

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
 * Try to extract sentiment from a frame (main page or iframe)
 */
async function extractFromFrame(frame: Frame | Page): Promise<ForexcomPosition[]> {
  try {
    return await frame.evaluate(() => {
      const results: Array<{ symbol: string; longPercent: number; shortPercent: number }> = [];
      const seen = new Set<string>();

      // Look for all elements with text content
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        null
      );

      let node: Node | null;
      while ((node = walker.nextNode())) {
        const el = node as Element;
        const text = el.textContent || '';

        // Skip large containers
        if (text.length > 300) continue;

        // Look for forex pairs
        const pairMatch = text.match(/\b([A-Z]{3})[\s\/]?([A-Z]{3})\b/);
        if (!pairMatch) continue;

        const symbol = `${pairMatch[1]}/${pairMatch[2]}`;
        const key = symbol.replace('/', '');
        if (seen.has(key)) continue;

        // Look for percentages
        const percents = text.match(/(\d{1,2}(?:\.\d+)?)\s*%/g);
        if (percents && percents.length >= 2) {
          const vals = percents.slice(0, 2).map(p => parseFloat(p));
          if (vals[0] >= 0 && vals[0] <= 100 && vals[1] >= 0 && vals[1] <= 100) {
            if (Math.abs(vals[0] + vals[1] - 100) <= 5) {
              seen.add(key);
              results.push({ symbol, longPercent: vals[0], shortPercent: vals[1] });
            }
          }
        }
      }

      return results;
    });
  } catch {
    return [];
  }
}

/**
 * Extract sentiment data from the page, including iframes
 */
async function extractSentiment(page: Page): Promise<ForexcomPosition[]> {
  let allPositions: ForexcomPosition[] = [];

  // Try main frame first
  const mainResults = await extractFromFrame(page);
  allPositions = allPositions.concat(mainResults);

  // Try all iframes
  const frames = page.frames();
  for (const frame of frames) {
    if (frame === page.mainFrame()) continue;
    try {
      const frameResults = await extractFromFrame(frame);
      allPositions = allPositions.concat(frameResults);
    } catch {
      // Ignore frame access errors
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return allPositions.filter(p => {
    const key = p.symbol.replace('/', '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Try to scrape from a single URL
 */
async function tryUrl(browser: Browser, url: string): Promise<ForexcomPosition[]> {
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    logger.debug(`Forex.com: Trying ${url}`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 45000,
    });

    // Wait for page to render
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, 500));
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Wait for any iframes to load
    await page.waitForFunction(
      () => document.querySelectorAll('iframe').length > 0 || document.body.innerText.includes('%'),
      { timeout: 10000 }
    ).catch(() => {});

    await new Promise(resolve => setTimeout(resolve, 3000));

    const positions = await extractSentiment(page);
    logger.debug(`Forex.com: Found ${positions.length} positions from ${url}`);

    return positions;
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Main scraper function for Forex.com
 */
export async function scrapeForexcom(): Promise<ScraperResult> {
  const timestamp = new Date();
  let browser: Browser | null = null;

  try {
    logger.debug('Starting Forex.com scraper');
    browser = await launchBrowser();

    // Try each URL until we get data
    for (const url of URLS) {
      try {
        const positions = await tryUrl(browser, url);

        if (positions.length > 0) {
          const data = parseForexcomData(positions);

          if (data.length > 0) {
            logger.info(`Forex.com scraped ${data.length} instruments from ${url}`);
            return {
              success: true,
              source: 'forexcom',
              data,
              timestamp,
            };
          }
        }
      } catch (error) {
        logger.debug(`Forex.com: Failed to scrape ${url}: ${error}`);
      }
    }

    // All URLs failed
    logger.warn('Forex.com: No sentiment data found from any source');
    return {
      success: false,
      source: 'forexcom',
      data: [],
      error: 'No sentiment data found on Forex.com or FXBlue',
      timestamp,
    };

  } catch (error) {
    logger.error('Forex.com scraper error:', error);
    return {
      success: false,
      source: 'forexcom',
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
