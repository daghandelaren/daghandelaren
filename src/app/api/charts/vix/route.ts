import { NextResponse } from 'next/server';
import { getVixChartData, getRiskStatus } from '@/services/risk-sentiment.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const chartData = await getVixChartData(90);
    const riskStatus = await getRiskStatus();

    return NextResponse.json({
      success: true,
      chartData,
      riskStatus,
    });
  } catch (error) {
    console.error('VIX chart API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch VIX data' },
      { status: 500 }
    );
  }
}
