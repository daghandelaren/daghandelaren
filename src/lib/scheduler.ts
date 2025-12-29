import { logger } from './utils';
import { prisma } from './prisma';

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;
const TWELVE_HOURS = 12 * ONE_HOUR;
const ONE_DAY = 24 * ONE_HOUR;

// Schedule time for fundamental analysis: 18:00 UTC
const SCHEDULED_HOUR = 18;
const SCHEDULED_MINUTE = 0;

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

/**
 * Run sentiment scrapers (hourly)
 */
async function runSentimentScrapers() {
  try {
    logger.info('[Scheduler] Starting hourly sentiment scrape');

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
    logger.error('[Scheduler] Sentiment scrape failed:', error);
  }
}

/**
 * Run fundamental analysis (daily at 18:00 UTC)
 * - Trading Economics CPI/PMI data
 * - AI analysis with Gemini
 */
async function runFundamentalAnalysis() {
  logger.info('[Scheduler] Running daily fundamental analysis (18:00 UTC)');

  try {
    // 1. Update economic data from Trading Economics (Core CPI)
    try {
      const { updateEconomicData } = await import('@/services/economic-data.service');
      const econResult = await updateEconomicData();
      logger.info(`[Scheduler] Economic data update: ${econResult.updated} currencies updated`);
    } catch (error) {
      logger.error('[Scheduler] Economic data update failed:', error);
    }

    // 2. Update PMI data from Trading Economics (Services PMI)
    try {
      const { updatePmiData } = await import('@/services/pmi-data.service');
      const pmiResult = await updatePmiData();
      logger.info(`[Scheduler] PMI data update: ${pmiResult.updated} currencies updated`);
    } catch (error) {
      logger.error('[Scheduler] PMI data update failed:', error);
    }

    // 3. Run AI analysis with Gemini (if configured)
    if (process.env.GEMINI_API_KEY) {
      try {
        const { analyzeMarket } = await import('@/services/ai.service');
        const aiResult = await analyzeMarket();

        if (aiResult.success) {
          logger.info('[Scheduler] AI analysis completed successfully');
        } else {
          logger.error('[Scheduler] AI analysis failed:', aiResult.error);
        }
      } catch (error) {
        logger.error('[Scheduler] AI analysis error:', error);
      }
    } else {
      logger.info('[Scheduler] Skipping AI analysis - GEMINI_API_KEY not configured');
    }

    // 4. Recalculate scores for all currencies
    try {
      const { recalculateAllScores } = await import('@/services/fundamental.service');
      await recalculateAllScores();
      logger.info('[Scheduler] Currency scores recalculated');
    } catch (error) {
      logger.error('[Scheduler] Score recalculation failed:', error);
    }

    logger.info('[Scheduler] Fundamental analysis completed');
  } catch (error) {
    logger.error('[Scheduler] Fundamental analysis error:', error);
  }
}

/**
 * Calculate milliseconds until next scheduled time (18:00 UTC)
 */
function getMillisecondsUntilScheduledTime(): number {
  const now = new Date();
  const scheduled = new Date(now);

  scheduled.setUTCHours(SCHEDULED_HOUR, SCHEDULED_MINUTE, 0, 0);

  // If scheduled time has passed today, schedule for tomorrow
  if (scheduled.getTime() <= now.getTime()) {
    scheduled.setUTCDate(scheduled.getUTCDate() + 1);
  }

  return scheduled.getTime() - now.getTime();
}

export function startScheduler() {
  if (isSchedulerRunning) {
    logger.info('[Scheduler] Already running, skipping');
    return;
  }

  isSchedulerRunning = true;

  const msUntilFundamental = getMillisecondsUntilScheduledTime();
  const hoursUntilFundamental = Math.round(msUntilFundamental / ONE_HOUR * 10) / 10;

  logger.info(`[Scheduler] Starting scheduler`);
  logger.info(`[Scheduler] - Sentiment scrapers: every hour`);
  logger.info(`[Scheduler] - Fundamental analysis: daily at 18:00 UTC (in ${hoursUntilFundamental} hours)`);

  // Run sentiment scrapers immediately on startup (with a small delay)
  setTimeout(() => {
    logger.info('[Scheduler] Running initial sentiment scrape on startup');
    runSentimentScrapers();
  }, 10000); // 10 second delay after startup

  // Schedule sentiment scrapers to run every hour
  setInterval(() => {
    runSentimentScrapers();
  }, ONE_HOUR);

  // Schedule fundamental analysis at 18:00 UTC
  setTimeout(() => {
    runFundamentalAnalysis();

    // Then run every 24 hours
    setInterval(() => {
      runFundamentalAnalysis();
    }, ONE_DAY);
  }, msUntilFundamental);

  logger.info('[Scheduler] Scheduler started');
}
