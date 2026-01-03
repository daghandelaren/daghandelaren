/**
 * Risk Sentiment Service - VIX-based Risk Regime Detection
 *
 * Logic:
 * - VIX below 3M avg & trending lower -> Risk-on
 * - VIX above 3M avg & trending higher -> Risk-off
 * - Otherwise -> Neutral
 *
 * Currency Overlays (max +/-0.5):
 * - Risk-On: AUD +0.5, NZD +0.5, CAD +0.25
 * - Risk-Off: JPY +0.5, CHF +0.5, USD +0.5
 */

import { prisma } from '@/lib/prisma';
import { getVixWithMa } from './fred.service';

export type RiskRegime = 'Risk-on' | 'Neutral' | 'Risk-off';

// Currency overlays for each risk regime (max ±0.5)
// Risk is meaningful but never dominant over core factors
const RISK_OVERLAYS: Record<RiskRegime, Record<string, number>> = {
  'Risk-on': {
    AUD: 0.5,
    NZD: 0.5,
    CAD: 0.25,   // Smaller due to oil correlation
    EUR: 0,
    GBP: 0,
    JPY: -0.5,   // Safe haven less attractive
    CHF: -0.5,
    USD: -0.5,
  },
  'Neutral': {
    AUD: 0,
    NZD: 0,
    CAD: 0,
    EUR: 0,
    GBP: 0,
    JPY: 0,
    CHF: 0,
    USD: 0,
  },
  'Risk-off': {
    AUD: -0.5,
    NZD: -0.5,
    CAD: -0.25,  // Smaller due to oil correlation
    EUR: 0,
    GBP: 0,
    JPY: 0.5,    // Safe haven attractive
    CHF: 0.5,
    USD: 0.5,
  },
};

/**
 * Determine risk regime from VIX data
 */
export async function calculateRiskRegime(): Promise<{
  regime: RiskRegime;
  vixCurrent: number | null;
  vixMa90: number | null;
  vixTrending: 'rising' | 'falling' | 'flat';
  justification: string;
}> {
  const vixData = await getVixWithMa();

  if (vixData.current === null || vixData.ma90 === null) {
    return {
      regime: 'Neutral',
      vixCurrent: null,
      vixMa90: null,
      vixTrending: 'flat',
      justification: 'Insufficient VIX data for risk regime calculation.',
    };
  }

  let regime: RiskRegime = 'Neutral';
  let justification = '';

  const { current, ma90, trending } = vixData;
  const pctDiff = ((current - ma90) / ma90) * 100;

  if (current < ma90 && trending === 'falling') {
    regime = 'Risk-on';
    justification = `VIX at ${current.toFixed(1)} is ${Math.abs(pctDiff).toFixed(1)}% below 90-day MA (${ma90.toFixed(1)}) and trending lower. Risk appetite elevated.`;
  } else if (current > ma90 && trending === 'rising') {
    regime = 'Risk-off';
    justification = `VIX at ${current.toFixed(1)} is ${pctDiff.toFixed(1)}% above 90-day MA (${ma90.toFixed(1)}) and trending higher. Flight to safety mode.`;
  } else {
    justification = `VIX at ${current.toFixed(1)} vs 90-day MA (${ma90.toFixed(1)}) with ${trending} trend. Mixed signals, neutral stance.`;
  }

  return {
    regime,
    vixCurrent: current,
    vixMa90: ma90,
    vixTrending: trending,
    justification,
  };
}

/**
 * Get risk overlay for a specific currency
 */
export function getRiskOverlay(currency: string, regime: RiskRegime): number {
  return RISK_OVERLAYS[regime][currency] || 0;
}

/**
 * Update global risk regime in database
 */
export async function updateRiskRegime(): Promise<{
  success: boolean;
  regime: RiskRegime;
  justification: string;
}> {
  try {
    const riskData = await calculateRiskRegime();

    // Update global settings
    await prisma.fundamentalSettings.updateMany({
      data: {
        riskRegime: riskData.regime,
        riskSentimentJustification: riskData.justification,
        vixCurrent: riskData.vixCurrent,
        vixMa90: riskData.vixMa90,
        vixTrending: riskData.vixTrending,
        lastUpdated: new Date(),
      },
    });

    console.log(`[Risk] Updated risk regime to: ${riskData.regime}`);
    console.log(`[Risk] ${riskData.justification}`);

    return {
      success: true,
      regime: riskData.regime,
      justification: riskData.justification,
    };

  } catch (error) {
    console.error('[Risk] Failed to update risk regime:', error);
    return {
      success: false,
      regime: 'Neutral',
      justification: 'Error calculating risk regime.',
    };
  }
}

/**
 * Apply risk overlays to all currencies
 */
export async function applyRiskOverlays(): Promise<number> {
  const settings = await prisma.fundamentalSettings.findFirst();
  const regime = (settings?.riskRegime as RiskRegime) || 'Neutral';

  const currencies = ['AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'JPY', 'NZD', 'USD'];
  let updated = 0;

  for (const currency of currencies) {
    const overlay = getRiskOverlay(currency, regime);

    // Convert overlay to integer for riskAdj (multiply by 2 to preserve granularity)
    // 0.5 -> 1, 0.25 -> 0 (rounded), -0.5 -> -1, etc.
    const riskAdj = Math.round(overlay * 2);

    try {
      await prisma.fundamentalCurrency.update({
        where: { currency },
        data: {
          riskAdj,
          lastUpdated: new Date(),
        },
      });
      updated++;
    } catch (error) {
      console.error(`[Risk] Failed to update ${currency}:`, error);
    }
  }

  console.log(`[Risk] Applied risk overlays to ${updated} currencies (regime: ${regime})`);
  return updated;
}

/**
 * Get VIX chart data
 */
export async function getVixChartData(days: number = 90): Promise<{
  dates: string[];
  values: number[];
  ma90: number[];
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const vixData = await prisma.vixData.findMany({
    where: { date: { gte: cutoff } },
    orderBy: { date: 'asc' },
  });

  const dates: string[] = [];
  const values: number[] = [];
  const ma90: number[] = [];

  for (let i = 0; i < vixData.length; i++) {
    dates.push(vixData[i].date.toISOString().split('T')[0]);
    values.push(vixData[i].value);

    // Calculate rolling 90-day MA (or all available if less than 90)
    const start = Math.max(0, i - 89);
    const slice = vixData.slice(start, i + 1);
    const avg = slice.reduce((sum, v) => sum + v.value, 0) / slice.length;
    ma90.push(avg);
  }

  return { dates, values, ma90 };
}

/**
 * Get current risk status for display
 */
export async function getRiskStatus(): Promise<{
  regime: RiskRegime;
  vixCurrent: number | null;
  vixMa90: number | null;
  vixTrending: string | null;
  justification: string | null;
}> {
  const settings = await prisma.fundamentalSettings.findFirst();

  return {
    regime: (settings?.riskRegime as RiskRegime) || 'Neutral',
    vixCurrent: settings?.vixCurrent || null,
    vixMa90: settings?.vixMa90 || null,
    vixTrending: settings?.vixTrending || null,
    justification: settings?.riskSentimentJustification || null,
  };
}
