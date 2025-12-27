import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldSnapshots } from '@/services/sentiment.service';
import { logger } from '@/lib/utils';

// GET /api/cron - Simple polling endpoint for scheduled scraping
// Can be called by:
// - External cron job (e.g., system crontab, Vercel cron)
// - Manual curl request
// - Frontend polling
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Optional: Verify cron secret for security
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');

    if (providedSecret !== cronSecret) {
      logger.warn('Cron request with invalid secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    logger.info('Cron job started');

    // Dynamic import to avoid bundling Puppeteer
    const { runAllScrapers } = await import('@/scrapers');

    // Run all scrapers
    const results = await runAllScrapers();

    // Cleanup old snapshots (keep last 7 days)
    const deletedCount = await cleanupOldSnapshots();

    const duration = Date.now() - startTime;

    const summary = {
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      scrapers: {
        total: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
      instruments: results.reduce((sum, r) => sum + r.data.length, 0),
      cleanup: {
        deletedSnapshots: deletedCount,
      },
      details: results.map((r) => ({
        source: r.source,
        success: r.success,
        instruments: r.data.length,
        error: r.error,
      })),
    };

    logger.info('Cron job completed', summary);

    return NextResponse.json(summary);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Cron job failed:', error);

    return NextResponse.json(
      {
        error: 'Cron job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// POST /api/cron - Alternative POST endpoint
export async function POST(request: NextRequest) {
  return GET(request);
}
