import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET - Get last update times for all data sources
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get latest CPI update (from FundamentalCurrency where cpiActual is set)
    const latestCpiUpdate = await prisma.fundamentalCurrency.findFirst({
      where: { cpiActual: { not: null } },
      orderBy: { lastUpdated: 'desc' },
      select: { lastUpdated: true },
    });

    // Get latest PMI update (from FundamentalCurrency where pmiActual is set)
    const latestPmiUpdate = await prisma.fundamentalCurrency.findFirst({
      where: { pmiActual: { not: null } },
      orderBy: { lastUpdated: 'desc' },
      select: { lastUpdated: true },
    });

    // Get latest Yield data update
    const latestYieldUpdate = await prisma.yieldData.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    // Get latest Commodity data update
    const latestCommodityUpdate = await prisma.commodityData.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return NextResponse.json({
      cpi: latestCpiUpdate?.lastUpdated?.toISOString() || null,
      pmi: latestPmiUpdate?.lastUpdated?.toISOString() || null,
      yields: latestYieldUpdate?.createdAt?.toISOString() || null,
      commodities: latestCommodityUpdate?.createdAt?.toISOString() || null,
    });
  } catch (error) {
    console.error('Data status error:', error);
    return NextResponse.json(
      { error: 'Failed to get data status' },
      { status: 500 }
    );
  }
}
