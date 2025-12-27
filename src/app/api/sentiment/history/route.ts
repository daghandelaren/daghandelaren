import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getHistoricalSentiment } from '@/services/sentiment.service';

// GET /api/sentiment/history?symbol=EUR/USD&days=14&interval=daily
// GET /api/sentiment/history?symbol=EUR/USD&hours=12&interval=hourly (protected)
export async function GET(request: NextRequest) {
  // Require authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const interval = (searchParams.get('interval') || 'daily') as 'hourly' | 'daily';
    const days = parseInt(searchParams.get('days') || '14', 10);
    const hours = parseInt(searchParams.get('hours') || '12', 10);

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    const { instrument, history } = await getHistoricalSentiment(symbol, interval, interval === 'hourly' ? hours : days);

    if (!instrument) {
      return NextResponse.json(
        { error: `Instrument not found: ${symbol}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      instrument,
      history,
      meta: {
        interval,
        ...(interval === 'hourly' ? { hours } : { days }),
        dataPoints: history.length,
      },
    });
  } catch (error) {
    console.error('Historical sentiment API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical sentiment data' },
      { status: 500 }
    );
  }
}
