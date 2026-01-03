/**
 * Fetch 90 Days Historical Data from Trading Economics
 *
 * This script extracts historical chart data from Trading Economics
 * by accessing the Highcharts data stored in the page.
 */

import { PrismaClient } from '@prisma/client';

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const prisma = new PrismaClient();

// Trading Economics URLs for yields (2-year bonds)
const YIELD_URLS: Record<string, string> = {
  EUR: 'https://tradingeconomics.com/germany/2-year-note-yield',
  GBP: 'https://tradingeconomics.com/united-kingdom/2-year-note-yield',
  JPY: 'https://tradingeconomics.com/japan/2-year-note-yield',
  CHF: 'https://tradingeconomics.com/switzerland/2-year-note-yield',
  AUD: 'https://tradingeconomics.com/australia/2-year-note-yield',
  NZD: 'https://tradingeconomics.com/new-zealand/2-year-note-yield',
  CAD: 'https://tradingeconomics.com/canada/2-year-note-yield',
  USD: 'https://tradingeconomics.com/united-states/2-year-note-yield',
};

// Trading Economics URLs for commodities
const COMMODITY_URLS: Record<string, string> = {
  IRON_ORE: 'https://tradingeconomics.com/commodity/iron-ore',
  COPPER: 'https://tradingeconomics.com/commodity/copper',
  DAIRY: 'https://tradingeconomics.com/commodity/milk',
  OIL_WTI: 'https://tradingeconomics.com/commodity/crude-oil',
};

interface ChartDataPoint {
  date: Date;
  value: number;
}

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
 * Extract historical chart data from Trading Economics page
 * The data is stored in Highcharts which we can access via JavaScript
 */
async function extractChartData(
  page: any,
  url: string,
  name: string,
  daysToFetch: number = 90
): Promise<ChartDataPoint[]> {
  const chartData: ChartDataPoint[] = [];

  try {
    console.log(`[TE 90D] Scraping ${name} from ${url}...`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait for Highcharts to fully render
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Extract data from Highcharts
    const extractedData = await page.evaluate(() => {
      const win = window as any;
      const results: { timestamp: number; value: number }[] = [];

      // Method 1: Access Highcharts directly
      if (win.Highcharts && win.Highcharts.charts) {
        for (const chart of win.Highcharts.charts) {
          if (chart && chart.series && chart.series.length > 0) {
            const series = chart.series[0];
            if (series.data && series.data.length > 0) {
              for (const point of series.data) {
                if (point && point.x !== undefined && point.y !== undefined) {
                  results.push({
                    timestamp: point.x,
                    value: point.y
                  });
                }
              }
              if (results.length > 0) break;
            }
            // Also try xData and yData arrays
            if (results.length === 0 && series.xData && series.yData) {
              for (let i = 0; i < series.xData.length; i++) {
                results.push({
                  timestamp: series.xData[i],
                  value: series.yData[i]
                });
              }
              if (results.length > 0) break;
            }
          }
        }
      }

      // Method 2: Look for chart data in window objects
      if (results.length === 0) {
        const possibleDataVars = ['chartData', 'seriesData', 'TEChartData', 'data'];
        for (const varName of possibleDataVars) {
          if (win[varName] && Array.isArray(win[varName])) {
            for (const item of win[varName]) {
              if (item && (item.x !== undefined || item[0] !== undefined)) {
                results.push({
                  timestamp: item.x || item[0],
                  value: item.y || item[1]
                });
              }
            }
            if (results.length > 0) break;
          }
        }
      }

      // Method 3: Parse from script tags containing chart initialization
      if (results.length === 0) {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          const content = script.textContent || '';

          // Look for data array patterns like [[timestamp, value], ...]
          const dataMatch = content.match(/data\s*:\s*\[\s*\[(\d+),\s*[\d.]+\]/);
          if (dataMatch) {
            // Try to extract the full array
            const arrayMatch = content.match(/data\s*:\s*(\[\s*\[[\d\s,.\[\]]+\]\s*\])/);
            if (arrayMatch) {
              try {
                const parsed = JSON.parse(arrayMatch[1].replace(/'/g, '"'));
                for (const item of parsed) {
                  if (Array.isArray(item) && item.length >= 2) {
                    results.push({
                      timestamp: item[0],
                      value: item[1]
                    });
                  }
                }
              } catch (e) {
                // Parse failed, continue
              }
            }
          }
        }
      }

      return results;
    });

    // Calculate cutoff date for filtering
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToFetch);

    // Process extracted data
    if (extractedData && extractedData.length > 0) {
      console.log(`[TE 90D] Found ${extractedData.length} raw data points for ${name}`);

      for (const point of extractedData) {
        if (point.timestamp && point.value !== undefined && !isNaN(point.value)) {
          const date = new Date(point.timestamp);

          // Only include data within our date range
          if (date >= cutoffDate && date <= new Date()) {
            // Normalize to start of day
            date.setHours(0, 0, 0, 0);

            chartData.push({
              date,
              value: point.value
            });
          }
        }
      }

      // Remove duplicates (same date)
      const seen = new Set<string>();
      const uniqueData: ChartDataPoint[] = [];
      for (const point of chartData) {
        const dateKey = point.date.toISOString().split('T')[0];
        if (!seen.has(dateKey)) {
          seen.add(dateKey);
          uniqueData.push(point);
        }
      }

      console.log(`[TE 90D] ${name}: ${uniqueData.length} data points within ${daysToFetch} days`);
      return uniqueData.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    console.log(`[TE 90D] No chart data found for ${name}, trying current value...`);

    // Fallback: Get current value only
    const currentValue = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      // Try various patterns
      const patterns = [
        /(?:Year Bond Yield|Year Note Yield)\s+(-?\d+\.?\d{0,4})\s+/i,
        /\b(-?\d+\.?\d{0,4})\s+[-+]?\d+\.?\d*\s+\([+-]/,
        /traded\s+at\s+(\d+[\d,]*\.?\d*)/i,
      ];

      for (const pattern of patterns) {
        const match = bodyText.match(pattern);
        if (match) {
          return parseFloat(match[1].replace(/,/g, ''));
        }
      }
      return null;
    });

    if (currentValue !== null && !isNaN(currentValue)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      chartData.push({ date: today, value: currentValue });
      console.log(`[TE 90D] ${name}: Got current value only: ${currentValue}`);
    }

    return chartData;

  } catch (error) {
    console.error(`[TE 90D] Error extracting ${name}:`, error);
    return chartData;
  }
}

/**
 * Click on "3M" or "6M" time selector to load more historical data
 */
async function selectTimeRange(page: any, range: string = '3M'): Promise<boolean> {
  try {
    // Look for time range selectors (1D, 1W, 1M, 3M, 6M, 1Y, etc.)
    const clicked = await page.evaluate((targetRange: string) => {
      // Find buttons/links with time range text
      const elements = document.querySelectorAll('a, button, span, div');
      for (const el of elements) {
        const text = el.textContent?.trim();
        if (text === targetRange || text === targetRange.toLowerCase()) {
          (el as HTMLElement).click();
          return true;
        }
      }

      // Try looking for specific classes Trading Economics uses
      const rangeSelectors = document.querySelectorAll('[class*="range"], [class*="period"], [class*="time"]');
      for (const el of rangeSelectors) {
        if (el.textContent?.includes(targetRange)) {
          (el as HTMLElement).click();
          return true;
        }
      }

      return false;
    }, range);

    if (clicked) {
      // Wait for chart to update
      await new Promise(resolve => setTimeout(resolve, 3000));
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function main() {
  let browser = null;

  try {
    console.log('[TE 90D] Starting 90-day historical data fetch...\n');

    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // ========== FETCH YIELDS ==========
    console.log('========== FETCHING 90 DAYS YIELD DATA ==========\n');

    const yieldResults: Record<string, ChartDataPoint[]> = {};

    for (const [currency, url] of Object.entries(YIELD_URLS)) {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      // Try to select 3M or 6M time range for more data
      await selectTimeRange(page, '3M');

      const data = await extractChartData(page, url, `${currency} 2Y Yield`, 90);
      yieldResults[currency] = data;

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Store yield data
    console.log('\n[TE 90D] Storing yield data...');
    let yieldStored = 0;

    for (const [currency, dataPoints] of Object.entries(yieldResults)) {
      for (const point of dataPoints) {
        try {
          const dateOnly = new Date(point.date);
          dateOnly.setHours(0, 0, 0, 0);

          await prisma.yieldData.upsert({
            where: {
              currency_date: { currency, date: dateOnly },
            },
            update: { yield2Y: point.value },
            create: {
              currency,
              date: dateOnly,
              yield2Y: point.value,
            },
          });
          yieldStored++;
        } catch (error) {
          // Skip duplicates or errors silently
        }
      }
    }

    console.log(`[TE 90D] Stored ${yieldStored} yield data points\n`);

    // ========== FETCH COMMODITIES ==========
    console.log('========== FETCHING 90 DAYS COMMODITY DATA ==========\n');

    const commodityResults: Record<string, ChartDataPoint[]> = {};

    for (const [commodity, url] of Object.entries(COMMODITY_URLS)) {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      // Try to select 3M time range for more data
      await selectTimeRange(page, '3M');

      const data = await extractChartData(page, url, commodity, 90);
      commodityResults[commodity] = data;

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Store commodity data
    console.log('\n[TE 90D] Storing commodity data...');
    let commodityStored = 0;

    for (const [commodity, dataPoints] of Object.entries(commodityResults)) {
      for (const point of dataPoints) {
        try {
          const dateOnly = new Date(point.date);
          dateOnly.setHours(0, 0, 0, 0);

          await prisma.commodityData.upsert({
            where: {
              commodity_date: { commodity, date: dateOnly },
            },
            update: { price: point.value },
            create: {
              commodity,
              date: dateOnly,
              price: point.value,
            },
          });
          commodityStored++;
        } catch (error) {
          // Skip duplicates or errors silently
        }
      }
    }

    console.log(`[TE 90D] Stored ${commodityStored} commodity data points\n`);

    // ========== SUMMARY ==========
    console.log('========== SUMMARY ==========');
    console.log(`Total yields stored: ${yieldStored}`);
    console.log(`Total commodities stored: ${commodityStored}`);

    console.log('\nYield data by currency:');
    for (const [currency, data] of Object.entries(yieldResults)) {
      const dateRange = data.length > 0
        ? `${data[0].date.toISOString().split('T')[0]} to ${data[data.length-1].date.toISOString().split('T')[0]}`
        : 'No data';
      console.log(`  ${currency}: ${data.length} days (${dateRange})`);
    }

    console.log('\nCommodity data:');
    for (const [commodity, data] of Object.entries(commodityResults)) {
      const dateRange = data.length > 0
        ? `${data[0].date.toISOString().split('T')[0]} to ${data[data.length-1].date.toISOString().split('T')[0]}`
        : 'No data';
      console.log(`  ${commodity}: ${data.length} days (${dateRange})`);
    }

  } catch (error) {
    console.error('[TE 90D] Fatal error:', error);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    await prisma.$disconnect();
  }
}

main();
