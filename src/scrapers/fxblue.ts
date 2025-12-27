import { Browser, Page } from 'puppeteer';
import { ScraperResult } from '@/types';
import { logger } from '@/lib/utils';
import { parseFxblueData, FxbluePosition } from './parsers/fxblue.parser';

// Use require for puppeteer-extra to avoid TypeScript issues
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to bypass bot detection
puppeteer.use(StealthPlugin());

const FXBLUE_URL = 'https://www.fxblue.com/market-data/tools/sentiment';

// Helper function for waiting
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Launch a Puppeteer browser instance with stealth settings
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
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });
}

/**
 * Extract sentiment data from the FXBlue page
 */
async function extractSentiment(page: Page): Promise<FxbluePosition[]> {
  const results: FxbluePosition[] = [];

  try {
    logger.debug('FXBlue: Navigating to sentiment page');

    // Set extra headers to look more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    await page.goto(FXBLUE_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait for page to fully load
    await wait(5000);

    // Scroll down to ensure content loads
    await page.evaluate(() => {
      window.scrollTo(0, 300);
    });
    await wait(2000);

    // Wait for iframe to appear
    logger.debug('FXBlue: Waiting for sentiment iframe');

    try {
      await page.waitForSelector('iframe', { timeout: 15000 });
    } catch {
      logger.debug('FXBlue: No iframe found, trying to extract from main page');
    }

    // Get all frames including the main frame
    const frames = page.frames();
    logger.debug(`FXBlue: Found ${frames.length} frames`);

    for (const frame of frames) {
      try {
        // Wait a bit for frame content to load
        await wait(1000);

        const frameData = await frame.evaluate(() => {
          const extracted: Array<{ symbol: string; longPercent: number; shortPercent: number }> = [];
          const seen = new Set<string>();

          // Get all text nodes and look for patterns
          const allText = document.body?.innerText || '';

          // Split by lines and look for forex pairs with percentages
          const lines = allText.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Look for forex pair pattern
            const pairMatch = line.match(/^([A-Z]{3})[\s\/]?([A-Z]{3})$/);
            if (pairMatch) {
              const symbol = `${pairMatch[1]}/${pairMatch[2]}`;
              const key = symbol.replace('/', '');

              if (seen.has(key)) continue;

              // Look at next few lines for percentages
              for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                const nextLine = lines[j].trim();
                const percentMatch = nextLine.match(/^(\d{1,2}(?:\.\d+)?)\s*%?$/);

                if (percentMatch) {
                  const val1 = parseFloat(percentMatch[1]);

                  // Look for second percentage
                  for (let k = j + 1; k < Math.min(j + 3, lines.length); k++) {
                    const nextLine2 = lines[k].trim();
                    const percentMatch2 = nextLine2.match(/^(\d{1,2}(?:\.\d+)?)\s*%?$/);

                    if (percentMatch2) {
                      const val2 = parseFloat(percentMatch2[1]);

                      if (val1 >= 0 && val1 <= 100 && val2 >= 0 && val2 <= 100) {
                        if (Math.abs(val1 + val2 - 100) <= 5) {
                          seen.add(key);
                          extracted.push({
                            symbol,
                            longPercent: val1,
                            shortPercent: val2,
                          });
                          break;
                        }
                      }
                    }
                  }
                  break;
                }
              }
            }
          }

          // Also try to find table-like structures
          const tables = document.querySelectorAll('table');
          for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            for (const row of rows) {
              const cells = row.querySelectorAll('td, th');
              const cellTexts = Array.from(cells).map(c => c.textContent?.trim() || '');

              for (let i = 0; i < cellTexts.length; i++) {
                const pairMatch = cellTexts[i].match(/^([A-Z]{3})[\s\/]?([A-Z]{3})$/);
                if (pairMatch) {
                  const symbol = `${pairMatch[1]}/${pairMatch[2]}`;
                  const key = symbol.replace('/', '');

                  if (seen.has(key)) continue;

                  // Look for percentages in subsequent cells
                  const remaining = cellTexts.slice(i + 1);
                  const percents = remaining
                    .map(t => {
                      const m = t.match(/(\d{1,2}(?:\.\d+)?)\s*%?/);
                      return m ? parseFloat(m[1]) : null;
                    })
                    .filter((v): v is number => v !== null && v >= 0 && v <= 100);

                  if (percents.length >= 2 && Math.abs(percents[0] + percents[1] - 100) <= 5) {
                    seen.add(key);
                    extracted.push({
                      symbol,
                      longPercent: percents[0],
                      shortPercent: percents[1],
                    });
                  }
                }
              }
            }
          }

          // Try finding elements with sentiment-related classes
          const sentimentElements = document.querySelectorAll('[class*="sentiment"], [class*="ratio"], [class*="long"], [class*="short"]');
          for (const el of sentimentElements) {
            const text = el.textContent || '';
            const parent = el.closest('[class*="row"], [class*="item"], tr');
            if (!parent) continue;

            const parentText = parent.textContent || '';
            const pairMatch = parentText.match(/([A-Z]{3})[\s\/]?([A-Z]{3})/);
            if (!pairMatch) continue;

            const symbol = `${pairMatch[1]}/${pairMatch[2]}`;
            const key = symbol.replace('/', '');
            if (seen.has(key)) continue;

            const percents = parentText.match(/(\d{1,2}(?:\.\d+)?)\s*%/g);
            if (percents && percents.length >= 2) {
              const vals = percents.map(p => parseFloat(p));
              if (vals[0] >= 0 && vals[0] <= 100 && vals[1] >= 0 && vals[1] <= 100) {
                if (Math.abs(vals[0] + vals[1] - 100) <= 5) {
                  seen.add(key);
                  extracted.push({
                    symbol,
                    longPercent: vals[0],
                    shortPercent: vals[1],
                  });
                }
              }
            }
          }

          return extracted;
        });

        if (frameData.length > 0) {
          logger.debug(`FXBlue: Found ${frameData.length} positions in frame`);
          results.push(...frameData);
        }
      } catch (err) {
        // Frame might be cross-origin, skip it
        logger.debug('FXBlue: Could not access frame content');
      }
    }

    // Deduplicate results
    const seen = new Set<string>();
    const deduplicated = results.filter(p => {
      const key = p.symbol.replace('/', '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    logger.debug(`FXBlue: Total extracted ${deduplicated.length} unique positions`);
    return deduplicated;

  } catch (error) {
    logger.error('FXBlue: Error extracting sentiment:', error);
    return results;
  }
}

/**
 * Main scraper function for FXBlue
 */
export async function scrapeFxblue(): Promise<ScraperResult> {
  const timestamp = new Date();
  let browser: Browser | null = null;

  try {
    logger.info('Starting FXBlue scraper');
    browser = await launchBrowser();

    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    );

    const positions = await extractSentiment(page);

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
