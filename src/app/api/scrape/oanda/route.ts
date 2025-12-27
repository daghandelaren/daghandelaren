import { NextRequest, NextResponse } from 'next/server';
import { scrapeOanda } from '@/scrapers/oanda';
import { saveSentimentData } from '@/services/sentiment.service';
import { logger } from '@/lib/utils';

// In-memory rate limiter for OANDA scraper (60s cooldown)
const OANDA_RATE_LIMIT_MS = 60 * 1000; // 60 seconds
let lastOandaScrape = 0;

/**
 * POST /api/scrape/oanda
 *
 * Trigger OANDA sentiment scraper
 * Protected by SCRAPE_SECRET env token
 * Rate limited to 1 request per 60 seconds
 *
 * Headers:
 *   Authorization: Bearer <SCRAPE_SECRET>
 *
 * Response:
 *   {
 *     success: boolean,
 *     source: "oanda",
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
  const timeSinceLastScrape = now - lastOandaScrape;

  if (timeSinceLastScrape < OANDA_RATE_LIMIT_MS) {
    const waitTimeMs = OANDA_RATE_LIMIT_MS - timeSinceLastScrape;
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
    lastOandaScrape = now;
    const timestamp = new Date();

    logger.info('OANDA scrape triggered via API');

    // Run the scraper
    const result = await scrapeOanda();

    if (!result.success) {
      return NextResponse.json({
        success: false,
        source: 'oanda',
        instrumentCount: 0,
        error: result.error,
        timestamp: timestamp.toISOString(),
      });
    }

    // Save to database
    const savedCount = await saveSentimentData('oanda', result.data);
    logger.info(`OANDA: Saved ${savedCount} sentiment records to database`);

    // Format response with full output contract
    const responseData = result.data.map((item) => ({
      symbol: item.symbol.replace('/', ''), // EURUSD format
      longPercent: item.longPercent,
      shortPercent: item.shortPercent,
      asOf: timestamp.toISOString(),
      assetClass: getAssetClass(item.symbol),
      source: 'oanda' as const,
    }));

    return NextResponse.json({
      success: true,
      source: 'oanda',
      instrumentCount: result.data.length,
      savedCount,
      data: responseData,
      timestamp: timestamp.toISOString(),
    });
  } catch (error) {
    logger.error('OANDA scrape API error:', error);

    return NextResponse.json(
      {
        success: false,
        source: 'oanda',
        instrumentCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scrape/oanda
 *
 * Get OANDA scraper status (rate limit info)
 */
export async function GET() {
  const now = Date.now();
  const timeSinceLastScrape = now - lastOandaScrape;
  const canRun = timeSinceLastScrape >= OANDA_RATE_LIMIT_MS;
  const waitTimeMs = canRun ? 0 : OANDA_RATE_LIMIT_MS - timeSinceLastScrape;

  return NextResponse.json({
    source: 'oanda',
    canRun,
    waitTimeSeconds: Math.ceil(waitTimeMs / 1000),
    nextAllowedAt: canRun ? null : new Date(now + waitTimeMs).toISOString(),
    rateLimitSeconds: OANDA_RATE_LIMIT_MS / 1000,
  });
}

/**
 * Determine asset class from symbol
 */
function getAssetClass(symbol: string): 'fx' | 'commodity' | 'index' {
  const upper = symbol.toUpperCase();

  // Commodities
  if (upper.includes('XAU') || upper.includes('XAG') || upper.includes('WTI') || upper.includes('BCO') || upper.includes('BRENT')) {
    return 'commodity';
  }

  // Indices
  if (upper.includes('SPX') || upper.includes('NAS') || upper.includes('US30') || upper.includes('UK100') || upper.includes('DE30')) {
    return 'index';
  }

  return 'fx';
}
