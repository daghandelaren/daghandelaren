import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Use dynamic imports to prevent Puppeteer from being bundled
type ScraperName = 'myfxbook' | 'oanda' | 'dukascopy' | 'forexfactory' | 'fxblue';

// POST /api/scrape - Trigger scraping (admin only)
export async function POST(request: NextRequest) {
  // Require admin role
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    // Dynamic import to avoid bundling Puppeteer
    const { runScraper, runAllScrapers } = await import('@/scrapers');

    const body = await request.json().catch(() => ({}));
    const { source } = body as { source?: ScraperName };

    if (source) {
      // Run specific scraper
      if (!['myfxbook', 'oanda', 'dukascopy', 'forexfactory', 'fxblue'].includes(source)) {
        return NextResponse.json(
          { error: 'Invalid source. Must be one of: myfxbook, oanda, dukascopy, forexfactory, fxblue' },
          { status: 400 }
        );
      }

      const result = await runScraper(source);

      return NextResponse.json({
        success: result.success,
        source: result.source,
        instrumentCount: result.data.length,
        error: result.error,
        timestamp: result.timestamp.toISOString(),
      });
    } else {
      // Run all scrapers
      const results = await runAllScrapers();

      return NextResponse.json({
        results: results.map((r) => ({
          success: r.success,
          source: r.source,
          instrumentCount: r.data.length,
          error: r.error,
          timestamp: r.timestamp.toISOString(),
        })),
        summary: {
          total: results.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          totalInstruments: results.reduce((sum, r) => sum + r.data.length, 0),
        },
      });
    }
  } catch (error) {
    console.error('Scrape API error:', error);
    return NextResponse.json({ error: 'Failed to run scraper' }, { status: 500 });
  }
}

// GET /api/scrape - Get scraper status (protected)
export async function GET() {
  // Require authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Dynamic import to avoid bundling Puppeteer
    const { getScraperStatus } = await import('@/scrapers');
    const status = getScraperStatus();

    return NextResponse.json({
      status: Object.entries(status).map(([name, info]) => ({
        name,
        canRun: info.canRun,
        waitTimeSeconds: Math.ceil(info.waitTime / 1000),
      })),
    });
  } catch (error) {
    console.error('Scrape status error:', error);
    return NextResponse.json({ error: 'Failed to get scraper status' }, { status: 500 });
  }
}
