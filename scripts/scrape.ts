// CLI script to manually trigger scraping
// Usage: npm run scrape

import { runAllScrapers, runScraper, ScraperName, getScraperStatus } from '../src/scrapers';
import { logger } from '../src/lib/utils';

async function main() {
  const args = process.argv.slice(2);
  const specificScraper = args[0] as ScraperName | undefined;

  console.log('\n=== Daghandelaren Scraper ===\n');

  // Show current status
  const status = getScraperStatus();
  console.log('Scraper Status:');
  for (const [name, info] of Object.entries(status)) {
    const statusText = info.canRun ? 'Ready' : `Wait ${Math.ceil(info.waitTime / 1000)}s`;
    console.log(`  ${name}: ${statusText}`);
  }
  console.log('');

  try {
    if (specificScraper) {
      // Run specific scraper
      if (!['myfxbook', 'oanda', 'dukascopy'].includes(specificScraper)) {
        console.error(`Unknown scraper: ${specificScraper}`);
        console.log('Available scrapers: myfxbook, oanda, dukascopy');
        process.exit(1);
      }

      console.log(`Running ${specificScraper} scraper...`);
      const result = await runScraper(specificScraper);

      if (result.success) {
        console.log(`\nSuccess! Scraped ${result.data.length} instruments from ${specificScraper}`);
        console.log('\nSample data:');
        result.data.slice(0, 5).forEach((item) => {
          console.log(`  ${item.symbol}: Long ${item.longPercent.toFixed(1)}% | Short ${item.shortPercent.toFixed(1)}%`);
        });
      } else {
        console.log(`\nFailed: ${result.error}`);
      }
    } else {
      // Run all scrapers
      console.log('Running all scrapers...\n');
      const results = await runAllScrapers();

      let totalSuccess = 0;
      let totalInstruments = 0;

      for (const result of results) {
        const status = result.success ? 'SUCCESS' : 'FAILED';
        console.log(`${result.source}: ${status}`);

        if (result.success) {
          totalSuccess++;
          totalInstruments += result.data.length;
          console.log(`  - Scraped ${result.data.length} instruments`);
        } else {
          console.log(`  - Error: ${result.error}`);
        }
      }

      console.log(`\n=== Summary ===`);
      console.log(`Successful: ${totalSuccess}/${results.length} scrapers`);
      console.log(`Total instruments: ${totalInstruments}`);
    }
  } catch (error) {
    logger.error('Scrape script failed:', error);
    process.exit(1);
  }

  console.log('\nDone!\n');
}

main();
