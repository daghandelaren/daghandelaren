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
  try {
    logger.debug('Navigating to Forex.com sentiment page');

    await page.goto(FOREXCOM_SENTIMENT_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait for sentiment data to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Extract sentiment data from the page
    const positions = await page.evaluate(() => {
      const results: Array<{ symbol: string; longPercent: number; shortPercent: number }> = [];
      const seen = new Set<string>();

      // Try to find sentiment data in various possible formats
      // Look for elements containing percentage data

      // Method 1: Look for table rows with sentiment data
      const rows = document.querySelectorAll('tr, [class*="sentiment"], [class*="instrument"]');

      for (const row of rows) {
        const text = row.textContent || '';

        // Look for forex pair pattern (e.g., EUR/USD, EURUSD)
        const pairMatch = text.match(/([A-Z]{3})\/?([A-Z]{3})/);
        if (!pairMatch) continue;

        const symbol = `${pairMatch[1]}/${pairMatch[2]}`;
        const key = symbol.replace('/', '');

        if (seen.has(key)) continue;

        // Look for percentage patterns (e.g., "65%" or "65.5%")
        const percentages = text.match(/(\d+\.?\d*)%/g);

        if (percentages && percentages.length >= 2) {
          const values = percentages.map(p => parseFloat(p.replace('%', '')));

          // Validate that we have reasonable percentages
          if (values[0] >= 0 && values[0] <= 100 && values[1] >= 0 && values[1] <= 100) {
            // Typically first percentage is long, second is short
            // But they might sum to 100, so validate
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

      // Method 2: Look for data attributes or JSON data
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || '';

        // Look for JSON data with sentiment info
        const jsonMatch = content.match(/\{[^{}]*"symbol"[^{}]*"long"[^{}]*\}/g);
        if (jsonMatch) {
          for (const match of jsonMatch) {
            try {
              const data = JSON.parse(match);
              if (data.symbol && typeof data.long === 'number' && typeof data.short === 'number') {
                const key = data.symbol.replace(/[/_]/g, '');
                if (!seen.has(key)) {
                  seen.add(key);
                  results.push({
                    symbol: data.symbol,
                    longPercent: data.long,
                    shortPercent: data.short,
                  });
                }
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Method 3: Look for specific CSS class patterns common in sentiment widgets
      const widgets = document.querySelectorAll('[class*="bar"], [class*="gauge"], [class*="percent"]');
      for (const widget of widgets) {
        const parent = widget.closest('[class*="row"], [class*="item"], [class*="card"]');
        if (!parent) continue;

        const parentText = parent.textContent || '';
        const pairMatch = parentText.match(/([A-Z]{3})\/?([A-Z]{3})/);
        if (!pairMatch) continue;

        const symbol = `${pairMatch[1]}/${pairMatch[2]}`;
        const key = symbol.replace('/', '');

        if (seen.has(key)) continue;

        // Look for width style or data attributes that might indicate percentage
        const style = widget.getAttribute('style') || '';
        const widthMatch = style.match(/width:\s*(\d+\.?\d*)%/);

        if (widthMatch) {
          const longPercent = parseFloat(widthMatch[1]);
          const shortPercent = 100 - longPercent;

          if (longPercent >= 0 && longPercent <= 100) {
            seen.add(key);
            results.push({
              symbol,
              longPercent,
              shortPercent,
            });
          }
        }
      }

      return results;
    });

    logger.debug(`Extracted ${positions.length} positions from Forex.com`);
    return positions;

  } catch (error) {
    logger.error('Error extracting Forex.com sentiment:', error);
    return [];
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
