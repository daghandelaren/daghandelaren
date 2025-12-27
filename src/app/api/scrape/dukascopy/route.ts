import { NextRequest, NextResponse } from 'next/server';
import { scrapeDukascopy } from '@/scrapers/dukascopy';
import { saveSentimentData } from '@/services/sentiment.service';
import { logger } from '@/lib/utils';
import { getAssetClass } from '@/scrapers/parsers/dukascopy.parser';

// In-memory rate limiter for Dukascopy scraper (60s cooldown)
const DUKASCOPY_RATE_LIMIT_MS = 60 * 1000; // 60 seconds
let lastDukascopyScrape = 0;

/**
 * POST /api/scrape/dukascopy
 *
 * Trigger Dukascopy sentiment scraper
 * Protected by SCRAPE_SECRET env token
 * Rate limited to 1 request per 60 seconds
 *
 * Headers:
 *   Authorization: Bearer <SCRAPE_SECRET>
 *
 * Response:
 *   {
 *     success: boolean,
 *     source: "dukascopy",
 *     instrumentCount: number,
 *     data?: Array<{ symbol, longPercent, shortPercent, asOf, assetClass, source }>,
 *     error?: string,
 *     timestamp: string,
 *     nextAllowedAt?: string
 *   }
 */
export async function POST(request: NextRequest) {
  // Verify authorization token
  const authHeader = request.headers.get('authorization');
  const scrapeSecret = process.env.SCRAPE_SECRET;

  if (scrapeSecret) {
    const token = authHeader?.replace('Bearer ', '');
    if (token !== scrapeSecret) {
      return NextResponse.json(
        { error: 'Unauthorized. Invalid or missing SCRAPE_SECRET token.' },
        { status: 401 }
      );
    }
  } else if (process.env.NODE_ENV === 'production') {
    // In production, require SCRAPE_SECRET to be set
    return NextResponse.json(
      { error: 'SCRAPE_SECRET not configured.' },
      { status: 500 }
    );
  }

  // Check rate limit (60s cooldown)
  const now = Date.now();
  const timeSinceLastScrape = now - lastDukascopyScrape;

  if (timeSinceLastScrape < DUKASCOPY_RATE_LIMIT_MS) {
    const waitTimeMs = DUKASCOPY_RATE_LIMIT_MS - timeSinceLastScrape;
    const nextAllowedAt = new Date(now + waitTimeMs).toISOString();

    return NextResponse.json(
      {
        error: `Rate limited. Please wait ${Math.ceil(waitTimeMs / 1000)} seconds.`,
        nextAllowedAt,
        waitTimeSeconds: Math.ceil(waitTimeMs / 1000),
      },
      { status: 429 }
    );
  }

  try {
    // Update last scrape time
    lastDukascopyScrape = now;
    const timestamp = new Date();

    logger.info('Dukascopy scrape triggered via API');

    // Run the scraper
    const result = await scrapeDukascopy();

    if (!result.success) {
      return NextResponse.json({
        success: false,
        source: 'dukascopy',
        instrumentCount: 0,
        error: result.error,
        timestamp: timestamp.toISOString(),
      });
    }

    // Save to database
    const savedCount = await saveSentimentData('dukascopy', result.data);
    logger.info(`Dukascopy: Saved ${savedCount} sentiment records to database`);

    // Format response with full output contract
    const responseData = result.data.map((item) => ({
      symbol: item.symbol.replace('/', ''), // EURUSD format
      longPercent: item.longPercent,
      shortPercent: item.shortPercent,
      asOf: timestamp.toISOString(),
      assetClass: getAssetClass(item.symbol),
      source: 'dukascopy' as const,
    }));

    return NextResponse.json({
      success: true,
      source: 'dukascopy',
      instrumentCount: result.data.length,
      savedCount,
      data: responseData,
      timestamp: timestamp.toISOString(),
    });
  } catch (error) {
    logger.error('Dukascopy scrape API error:', error);

    return NextResponse.json(
      {
        success: false,
        source: 'dukascopy',
        instrumentCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scrape/dukascopy
 *
 * Get Dukascopy scraper status (rate limit info)
 */
export async function GET() {
  const now = Date.now();
  const timeSinceLastScrape = now - lastDukascopyScrape;
  const canRun = timeSinceLastScrape >= DUKASCOPY_RATE_LIMIT_MS;
  const waitTimeMs = canRun ? 0 : DUKASCOPY_RATE_LIMIT_MS - timeSinceLastScrape;

  return NextResponse.json({
    source: 'dukascopy',
    canRun,
    waitTimeSeconds: Math.ceil(waitTimeMs / 1000),
    nextAllowedAt: canRun ? null : new Date(now + waitTimeMs).toISOString(),
    rateLimitSeconds: DUKASCOPY_RATE_LIMIT_MS / 1000,
  });
}
