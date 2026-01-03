import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateCommodityData, applyCommodityTailwinds } from '@/services/commodities.service';
import { recalculateAllScores } from '@/services/fundamental.service';

/**
 * POST - Trigger commodity data update (admin only)
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

    // Update commodity data
    const result = await updateCommodityData();

    // Apply commodity tailwinds
    await applyCommodityTailwinds();

    // Recalculate scores
    await recalculateAllScores();

    return NextResponse.json({
      success: true,
      updated: result.updated,
      message: `Updated ${result.updated} commodities`,
    });
  } catch (error) {
    console.error('Commodity data update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
