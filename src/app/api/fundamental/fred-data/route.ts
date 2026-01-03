import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateAllFredData } from '@/services/fred.service';
import { applyCommodityTailwinds } from '@/services/commodities.service';
import { recalculateAllScores } from '@/services/fundamental.service';

/**
 * POST - Trigger FRED data update (admin only)
 * Updates: VIX, US 2Y Yield, WTI Oil
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = session.user as { role?: string };
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Update all FRED data
    const result = await updateAllFredData();

    // Apply commodity tailwinds (for WTI Oil -> CAD)
    await applyCommodityTailwinds();

    // Recalculate scores
    await recalculateAllScores();

    const totalCount = result.vix.count + result.usYield.count + result.oil.count;

    return NextResponse.json({
      success: true,
      updated: totalCount,
      details: {
        vix: result.vix.count,
        usYield: result.usYield.count,
        oil: result.oil.count,
      },
      message: `Updated FRED data: VIX(${result.vix.count}), US2Y(${result.usYield.count}), Oil(${result.oil.count})`,
    });
  } catch (error) {
    console.error('FRED data update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
