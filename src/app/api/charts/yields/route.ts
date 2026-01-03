import { NextResponse } from 'next/server';
import { getYieldChartData, calculateYieldDifferentials } from '@/services/yields.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const chartData = await getYieldChartData(90);
    const differentials = await calculateYieldDifferentials();

    return NextResponse.json({
      success: true,
      chartData,
      currentSignals: differentials,
    });
  } catch (error) {
    console.error('Yield chart API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch yield data' },
      { status: 500 }
    );
  }
}
