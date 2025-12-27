import { Browser, Page } from 'puppeteer';
import { ScraperResult } from '@/types';
import { logger } from '@/lib/utils';
import { parseForexcomData, ForexcomPosition } from './parsers/forexcom.parser';

// Use require for puppeteer-extra to avoid TypeScript issues
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to bypass Cloudflare
puppeteer.use(StealthPlugin());

const FOREXCOM_SENTIMENT_URL = 'https://www.forex.com/en-us/trading-tools/client-sentiment/';

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
 * Extract sentiment data from the Forex.com page
 */
async function extractSentiment(page: Page): Promise<ForexcomPosition[]> {
  const capturedData: ForexcomPosition[] = [];

  try {
    // Intercept network requests to capture sentiment API data
    await page.setRequestInterception(true);

    page.on('request', (request) => {
      request.continue();
    });

    page.on('response', async (response) => {
      const url = response.url();
      // Look for API calls that might contain sentiment data
      if (url.includes('sentiment') || url.includes('position') || url.includes('ratio')) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('json')) {
            const json = await response.json();
            logger.debug('Forex.com API response:', url);
            // Try to extract data from the API response
            if (Array.isArray(json)) {
              for (const item of json) {
                if (item.symbol && (item.longPercent !== undefined || item.long !== undefined)) {
                  capturedData.push({
                    symbol: item.symbol,
                    longPercent: item.longPercent ?? item.long ?? 0,
                    shortPercent: item.shortPercent ?? item.short ?? 0,
                  });
                }
              }
            }
          }
        } catch {
          // Ignore response parsing errors
        }
      }
    });

    logger.debug('Navigating to Forex.com sentiment page');

    await page.goto(FOREXCOM_SENTIMENT_URL, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    // Wait longer for JavaScript to render the sentiment widget
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Scroll down to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // If we captured data from API, return it
    if (capturedData.length > 0) {
      logger.debug(`Captured ${capturedData.length} positions from Forex.com API`);
      return capturedData;
    }

    // Otherwise try to extract from DOM
    const positions = await page.evaluate(() => {
      const results: Array<{ symbol: string; longPercent: number; shortPercent: number }> = [];
      const seen = new Set<string>();

      // Method 1: Look for sentiment widget/table rows
      const allElements = document.querySelectorAll('*');

      for (const el of allElements) {
        const text = el.textContent || '';
        const classList = el.className || '';

        // Skip if element has too much text (likely a container)
        if (text.length > 500) continue;

        // Look for forex pair pattern
        const pairMatch = text.match(/\b([A-Z]{3})[\s\/]?([A-Z]{3})\b/);
        if (!pairMatch) continue;

        const symbol = `${pairMatch[1]}/${pairMatch[2]}`;
        const key = symbol.replace('/', '');

        if (seen.has(key)) continue;

        // Look for percentage patterns
        const percentages = text.match(/(\d{1,2}(?:\.\d+)?)\s*%/g);

        if (percentages && percentages.length >= 2) {
          const values = percentages.slice(0, 2).map(p => parseFloat(p.replace('%', '')));

          if (values[0] >= 0 && values[0] <= 100 && values[1] >= 0 && values[1] <= 100) {
            if (Math.abs(values[0] + values[1] - 100) <= 5) {
              seen.add(key);
              results.push({
                symbol,
                longPercent: values[0],
                shortPercent: values[1],
              });
            }
          }
        }
      }

      // Method 2: Check for sentiment data in __NEXT_DATA__ or similar
      const nextDataScript = document.getElementById('__NEXT_DATA__');
      if (nextDataScript) {
        try {
          const data = JSON.parse(nextDataScript.textContent || '{}');
          const searchForSentiment = (obj: unknown, depth = 0): void => {
            if (depth > 10 || !obj || typeof obj !== 'object') return;

            if (Array.isArray(obj)) {
              for (const item of obj) {
                if (item && typeof item === 'object' && 'symbol' in item) {
                  const i = item as Record<string, unknown>;
                  if (typeof i.long === 'number' || typeof i.longPercent === 'number') {
                    const symbol = String(i.symbol);
                    const key = symbol.replace(/[/_]/g, '');
                    if (!seen.has(key)) {
                      seen.add(key);
                      results.push({
                        symbol,
                        longPercent: (i.longPercent as number) ?? (i.long as number) ?? 0,
                        shortPercent: (i.shortPercent as number) ?? (i.short as number) ?? 0,
                      });
                    }
                  }
                }
                searchForSentiment(item, depth + 1);
              }
            } else {
              for (const value of Object.values(obj)) {
                searchForSentiment(value, depth + 1);
              }
            }
          };
          searchForSentiment(data);
        } catch {
          // Ignore parse errors
        }
      }

      // Method 3: Check all script tags for embedded JSON data
      const scripts = document.querySelectorAll('script:not([src])');
      for (const script of scripts) {
        const content = script.textContent || '';
        // Look for arrays with sentiment-like objects
        const matches = content.match(/\[\s*\{[^[\]]*"(?:symbol|instrument|pair)"[^[\]]*\}\s*(?:,\s*\{[^[\]]*\}\s*)*\]/g);
        if (matches) {
          for (const match of matches) {
            try {
              const arr = JSON.parse(match);
              for (const item of arr) {
                if (item.symbol && (item.long !== undefined || item.longPercent !== undefined)) {
                  const key = item.symbol.replace(/[/_]/g, '');
                  if (!seen.has(key)) {
                    seen.add(key);
                    results.push({
                      symbol: item.symbol,
                      longPercent: item.longPercent ?? item.long ?? 0,
                      shortPercent: item.shortPercent ?? item.short ?? 0,
                    });
                  }
                }
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      return results;
    });

    logger.debug(`Extracted ${positions.length} positions from Forex.com DOM`);
    return positions;

  } catch (error) {
    logger.error('Error extracting Forex.com sentiment:', error);
    return capturedData.length > 0 ? capturedData : [];
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
    const page = await browser.newPage();

    // Set a realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Extract sentiment data
    const rawPositions = await extractSentiment(page);

    if (rawPositions.length === 0) {
      logger.warn('Forex.com: No sentiment data found');
      return {
        success: false,
        source: 'forexcom',
        data: [],
        error: 'No sentiment data found on Forex.com page',
        timestamp,
      };
    }

    // Parse and normalize data
    const data = parseForexcomData(rawPositions);

    if (data.length === 0) {
      return {
        success: false,
        source: 'forexcom',
        data: [],
        error: 'Failed to parse Forex.com sentiment data',
        timestamp,
      };
    }

    logger.info(`Forex.com scraped ${data.length} instruments`);

    return {
      success: true,
      source: 'forexcom',
      data,
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
