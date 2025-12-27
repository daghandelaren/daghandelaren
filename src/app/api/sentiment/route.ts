import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLatestSentiment, getOverviewData, getActiveSources, getNewOverviewData } from '@/services/sentiment.service';
import type { SentimentFilters } from '@/types';

// GET /api/sentiment - Fetch latest sentiment data (protected)
export async function GET(request: NextRequest) {
  // Require authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters
    const filters: SentimentFilters = {
      search: searchParams.get('search') || undefined,
      source: searchParams.get('source') || undefined,
      assetClass: searchParams.get('assetClass') || undefined,
      sortBy: (searchParams.get('sortBy') as SentimentFilters['sortBy']) || undefined,
      sortOrder: (searchParams.get('sortOrder') as SentimentFilters['sortOrder']) || 'desc',
    };

    // Check for overview request
    const includeOverview = searchParams.get('overview') === 'true';
    const includeNewOverview = searchParams.get('newOverview') === 'true';

    // Fetch data
    const [sentiment, sources] = await Promise.all([getLatestSentiment(filters), getActiveSources()]);

    // Get overview data if requested
    const overview = includeOverview ? await getOverviewData() : undefined;
    const newOverview = includeNewOverview ? await getNewOverviewData() : undefined;

    // Calculate last updated time
    const lastUpdated =
      sentiment.length > 0
        ? new Date(Math.max(...sentiment.map((s) => s.lastUpdated.getTime())))
        : new Date();

    return NextResponse.json({
      data: sentiment.map((item) => ({
        id: item.instrument.id,
        symbol: item.instrument.symbol,
        base: item.instrument.base,
        quote: item.instrument.quote,
        assetClass: item.instrument.assetClass,
        // Legacy average values
        longPercent: item.avgLongPercent,
        shortPercent: item.avgShortPercent,
        netSentiment: item.avgNetSentiment,
        // Weighted blended values (M=2, O=2, D=1)
        blendedLong: item.blendedLong,
        blendedShort: item.blendedShort,
        blendedNet: item.blendedNet,
        sourcesUsed: item.sourcesUsed,
        sources: item.sources.map((s) => ({
          name: s.source.name,
          longPercent: s.longPercent,
          shortPercent: s.shortPercent,
          netSentiment: s.netSentiment,
          timestamp: s.timestamp.toISOString(),
        })),
        lastUpdated: item.lastUpdated.toISOString(),
      })),
      overview,
      newOverview,
      meta: {
        total: sentiment.length,
        sources,
        lastUpdated: lastUpdated.toISOString(),
        filters: {
          search: filters.search,
          source: filters.source,
          assetClass: filters.assetClass,
        },
      },
    });
  } catch (error) {
    console.error('Sentiment API error:', error);
    return NextResponse.json({ error: 'Failed to fetch sentiment data' }, { status: 500 });
  }
}
