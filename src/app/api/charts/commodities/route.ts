import { NextResponse } from 'next/server';
import { getCommodityChartData } from '@/services/commodities.service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const chartData = await getCommodityChartData(90);

    // Get current commodity signals for each currency
    const currencies = await prisma.fundamentalCurrency.findMany({
      where: {
        currency: { in: ['AUD', 'CAD', 'NZD'] },
      },
      select: {
        currency: true,
        commodityTailwind: true,
        commodityBasket: true,
        commodityMa90: true,
        commodityAdj: true,
      },
    });

    return NextResponse.json({
      success: true,
      chartData,
      currencySignals: currencies,
    });
  } catch (error) {
    console.error('Commodities chart API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch commodity data' },
      { status: 500 }
    );
  }
}
