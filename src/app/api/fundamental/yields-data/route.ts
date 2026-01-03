import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateYieldData, applyYieldDifferentials } from '@/services/yields.service';
import { recalculateAllScores } from '@/services/fundamental.service';

/**
 * POST - Trigger yield data update (admin only)
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

    // Update yield data
    const result = await updateYieldData();

    // Apply yield differentials
    await applyYieldDifferentials();

    // Recalculate scores
    await recalculateAllScores();

    return NextResponse.json({
      success: true,
      updated: result.updated,
      message: `Updated ${result.updated} currencies with yield data`,
    });
  } catch (error) {
    console.error('Yield data update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
