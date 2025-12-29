import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updatePmiData, fetchPmiDataRaw } from '@/services/pmi-data.service';

/**
 * GET - Fetch raw PMI data (for debugging)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await fetchPmiDataRaw();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('PMI data fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PMI data' },
      { status: 500 }
    );
  }
}

/**
 * POST - Trigger PMI data update (admin only)
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

    const result = await updatePmiData();

    return NextResponse.json(result);
  } catch (error) {
    console.error('PMI data update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
