import { Browser, Page, Frame } from 'puppeteer';
import { ScraperResult } from '@/types';
import { logger } from '@/lib/utils';
import { parseFxblueData, FxbluePosition } from './parsers/fxblue.parser';

// Use require for puppeteer-extra to avoid TypeScript issues
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to bypass bot detection
puppeteer.use(StealthPlugin());

const FXBLUE_URL = 'https://www.fxblue.com/market-data/tools/sentiment';

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
async function extractFromFrame(frame: Frame | Page): Promise<FxbluePosition[]> {
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
async function extractSentiment(page: Page): Promise<FxbluePosition[]> {
  let allPositions: FxbluePosition[] = [];

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
 * Try to scrape from FXBlue URL
 */
async function tryUrl(browser: Browser, url: string): Promise<FxbluePosition[]> {
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    logger.debug(`FXBlue: Navigating to ${url}`);

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
    logger.debug(`FXBlue: Found ${positions.length} positions`);

    return positions;
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Main scraper function for FXBlue
 */
export async function scrapeFxblue(): Promise<ScraperResult> {
  const timestamp = new Date();
  let browser: Browser | null = null;

  try {
    logger.debug('Starting FXBlue scraper');
    browser = await launchBrowser();

    const positions = await tryUrl(browser, FXBLUE_URL);

    if (positions.length > 0) {
      const data = parseFxblueData(positions);

      if (data.length > 0) {
        logger.info(`FXBlue scraped ${data.length} instruments`);
        return {
          success: true,
          source: 'fxblue',
          data,
          timestamp,
        };
      }
    }

    logger.warn('FXBlue: No sentiment data found');
    return {
      success: false,
      source: 'fxblue',
      data: [],
      error: 'No sentiment data found on FXBlue',
      timestamp,
    };

  } catch (error) {
    logger.error('FXBlue scraper error:', error);
    return {
      success: false,
      source: 'fxblue',
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
