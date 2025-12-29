/**
 * POST /api/fundamental/analyze - Trigger AI market analysis
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { analyzeMarket, isConfigured } from '@/services/ai.service';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role for manual trigger
    if (session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!isConfigured()) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured. Add it to your environment variables.' },
        { status: 500 }
      );
    }

    const result = await analyzeMarket();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'Analysis failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Analysis complete',
      result: result.result,
    });
  } catch (error) {
    console.error('Error running analysis:', error);
    return NextResponse.json(
      { error: 'Failed to run analysis' },
      { status: 500 }
    );
  }
}
