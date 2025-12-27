import { logger } from './utils';
import { prisma } from './prisma';

const ONE_HOUR = 60 * 60 * 1000;
const TWELVE_HOURS = 12 * ONE_HOUR;

let isSchedulerRunning = false;

async function cleanupOldLogs() {
  try {
    const cutoff = new Date(Date.now() - TWELVE_HOURS);
    const result = await prisma.scraperLog.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });
    if (result.count > 0) {
      logger.info(`[Scheduler] Cleaned up ${result.count} old scraper logs`);
    }
  } catch (error) {
    logger.error('[Scheduler] Failed to cleanup old logs:', error);
  }
}

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

    // Get failed scraper details
    const failedResults = results.filter(r => !r.success);
    const failedScraperNames = failedResults.map(r => r.source);
    const errorMessages = failedResults.map(r => r.error || 'Unknown error');

    // Log to database
    await prisma.scraperLog.create({
      data: {
        totalScrapers: results.length,
        successCount: successful,
        failedCount: failed,
        instrumentCount: instruments,
        failedScrapers: failedScraperNames,
        errorMessages: errorMessages,
        deletedSnapshots: deletedCount,
      },
    });

    logger.info(`[Scheduler] Scrape completed: ${successful}/${results.length} scrapers succeeded, ${instruments} instruments, ${deletedCount} old snapshots deleted`);

    if (failed > 0) {
      const failedScrapers = results.filter(r => !r.success).map(r => `${r.source}: ${r.error}`);
      logger.warn('[Scheduler] Failed scrapers:', failedScrapers);
    }

    // Cleanup old logs
    await cleanupOldLogs();
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
