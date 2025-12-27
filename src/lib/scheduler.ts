import { logger } from './utils';

const ONE_HOUR = 60 * 60 * 1000;

let isSchedulerRunning = false;

async function runScrapeJob() {
  try {
    logger.info('[Scheduler] Starting hourly scrape job');

    // Dynamic import to avoid bundling issues
    const { runAllScrapers } = await import('@/scrapers');
    const { cleanupOldSnapshots } = await import('@/services/sentiment.service');

    const results = await runAllScrapers();
    const deletedCount = await cleanupOldSnapshots();

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const instruments = results.reduce((sum, r) => sum + r.data.length, 0);

    logger.info(`[Scheduler] Scrape completed: ${successful}/${results.length} scrapers succeeded, ${instruments} instruments, ${deletedCount} old snapshots deleted`);

    if (failed > 0) {
      const failedScrapers = results.filter(r => !r.success).map(r => `${r.source}: ${r.error}`);
      logger.warn('[Scheduler] Failed scrapers:', failedScrapers);
    }
  } catch (error) {
    logger.error('[Scheduler] Scrape job failed:', error);
  }
}

export function startScheduler() {
  if (isSchedulerRunning) {
    logger.info('[Scheduler] Already running, skipping');
    return;
  }

  isSchedulerRunning = true;
  logger.info('[Scheduler] Starting hourly scraper scheduler');

  // Run immediately on startup (with a small delay to let the app initialize)
  setTimeout(() => {
    logger.info('[Scheduler] Running initial scrape');
    runScrapeJob();
  }, 10000); // 10 second delay after startup

  // Then run every hour
  setInterval(() => {
    runScrapeJob();
  }, ONE_HOUR);

  logger.info('[Scheduler] Scheduler started - will scrape every hour');
}
