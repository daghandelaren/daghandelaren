/* eslint-disable @typescript-eslint/no-var-requires */
import { Browser, Page } from 'puppeteer';
import { ScraperResult } from '@/types';
import { logger } from '@/lib/utils';
import { parseMyfxbookData, MyfxbookSymbol } from './parsers/myfxbook.parser';

// Use require for puppeteer-extra to avoid TypeScript issues
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to bypass Cloudflare
puppeteer.use(StealthPlugin());

const MYFXBOOK_OUTLOOK_URL = 'https://www.myfxbook.com/community/outlook';

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
 * Extract community outlook data from the page
 */
async function extractOutlookData(page: Page): Promise<MyfxbookSymbol[]> {
  try {
    logger.debug('Navigating to Myfxbook community outlook page');

    await page.goto(MYFXBOOK_OUTLOOK_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait for the data to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we're on a Cloudflare challenge page
    const pageContent = await page.content();
    if (pageContent.includes('Just a moment') || pageContent.includes('challenge-platform')) {
      logger.debug('Cloudflare challenge detected, waiting...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Extract the outlook data from the page
    const symbols = await page.evaluate(() => {
      const results: Array<{
        name: string;
        shortPercentage: number;
        longPercentage: number;
        shortVolume: number;
        longVolume: number;
        shortPositions: number;
        longPositions: number;
      }> = [];

      // Find all outlook rows - Myfxbook uses a table with class 'table-alt'
      const rows = document.querySelectorAll('table.outlookTable tbody tr, table tbody tr');

      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 5) continue;

        // Get symbol name from first cell
        const symbolCell = cells[0];
        const symbolText = symbolCell?.textContent?.trim() || '';

        // Skip if not a valid forex pair
        if (!symbolText.match(/^[A-Z]{6}$/i) && !symbolText.match(/^[A-Z]{3}\/[A-Z]{3}$/i)) {
          continue;
        }

        // Normalize symbol (EURUSD -> EUR/USD)
        let name = symbolText.toUpperCase();
        if (name.length === 6 && !name.includes('/')) {
          name = name.slice(0, 3) + '/' + name.slice(3);
        }

        // Extract percentages - look for percentage values in the row
        const rowText = row.textContent || '';
        const percentMatches = rowText.match(/(\d+(?:\.\d+)?)\s*%/g);

        if (percentMatches && percentMatches.length >= 2) {
          const shortPct = parseFloat(percentMatches[0]);
          const longPct = parseFloat(percentMatches[1]);

          // Validate percentages add up to ~100%
          if (Math.abs(shortPct + longPct - 100) <= 5) {
            results.push({
              name,
              shortPercentage: shortPct,
              longPercentage: longPct,
              shortVolume: 0,
              longVolume: 0,
              shortPositions: 0,
              longPositions: 0,
            });
          }
        }
      }

      return results;
    });

    // If table extraction didn't work, try alternative method
    if (symbols.length === 0) {
      logger.debug('Table extraction failed, trying JSON extraction');

      // Try to find data in script tags or JSON embedded in page
      const jsonData = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          const content = script.textContent || '';
          // Look for outlook data patterns
          if (content.includes('outlookData') || content.includes('symbols')) {
            const match = content.match(/\[[\s\S]*?"name"[\s\S]*?\]/);
            if (match) {
              try {
                return JSON.parse(match[0]);
              } catch {
                // Continue searching
              }
            }
          }
        }
        return null;
      });

      if (jsonData && Array.isArray(jsonData)) {
        return jsonData;
      }
    }

    logger.debug(`Extracted ${symbols.length} symbols from Myfxbook`);
    return symbols;

  } catch (error) {
    logger.error('Error extracting Myfxbook outlook data:', error);
    return [];
  }
}

/**
 * Main scraper function for Myfxbook
 * Uses web scraping since the API is now protected by Cloudflare
 */
export async function scrapeMyfxbook(): Promise<ScraperResult> {
  const timestamp = new Date();
  let browser: Browser | null = null;

  try {
    logger.debug('Starting Myfxbook scraper');

    browser = await launchBrowser();
    const page = await browser.newPage();

    // Set a realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Extract outlook data
    const rawSymbols = await extractOutlookData(page);

    if (rawSymbols.length === 0) {
      logger.warn('Myfxbook: No outlook data found');
      return {
        success: false,
        source: 'myfxbook',
        data: [],
        error: 'No outlook data found on Myfxbook community page',
        timestamp,
      };
    }

    // Parse and normalize data
    const data = parseMyfxbookData(rawSymbols);

    if (data.length === 0) {
      return {
        success: false,
        source: 'myfxbook',
        data: [],
        error: 'Failed to parse Myfxbook outlook data',
        timestamp,
      };
    }

    logger.info(`Myfxbook scraped ${data.length} instruments`);

    return {
      success: true,
      source: 'myfxbook',
      data,
      timestamp,
    };

  } catch (error) {
    logger.error('Myfxbook scraper error:', error);

    return {
      success: false,
      source: 'myfxbook',
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
