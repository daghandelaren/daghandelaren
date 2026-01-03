/**
 * FRED API Service
 * Federal Reserve Economic Data - Free API
 * https://fred.stlouisfed.org/docs/api/fred/
 *
 * Data series used:
 * - VIXCLS: VIX Close (daily)
 * - DGS2: 2-Year Treasury Constant Maturity Rate (daily)
 * - DCOILWTICO: WTI Crude Oil Price (daily)
 */

import { prisma } from '@/lib/prisma';

const FRED_API_KEY = process.env.FRED_API_KEY || '';
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';

// FRED series IDs
const SERIES = {
  VIX: 'VIXCLS',
  US_2Y: 'DGS2',
  OIL_WTI: 'DCOILWTICO',
};

interface FredObservation {
  date: string;
  value: string;
}

interface FredResponse {
  observations: FredObservation[];
}

/**
 * Fetch data from FRED API
 */
async function fetchFredSeries(
  seriesId: string,
  startDate?: string
): Promise<FredObservation[]> {
  if (!FRED_API_KEY) {
    console.warn('[FRED] API key not configured');
    return [];
  }

  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: FRED_API_KEY,
    file_type: 'json',
    sort_order: 'desc',
    limit: '100', // Get last 100 observations
  });

  if (startDate) {
    params.set('observation_start', startDate);
  }

  try {
    const response = await fetch(`${FRED_BASE_URL}?${params}`);

    if (!response.ok) {
      throw new Error(`FRED API error: ${response.status}`);
    }

    const data: FredResponse = await response.json();
    return data.observations.filter((obs) => obs.value !== '.');
  } catch (error) {
    console.error(`[FRED] Failed to fetch ${seriesId}:`, error);
    return [];
  }
}

/**
 * Fetch and store VIX data
 */
export async function updateVixData(): Promise<{ success: boolean; count: number }> {
  console.log('[FRED] Fetching VIX data...');

  const observations = await fetchFredSeries(SERIES.VIX);

  if (observations.length === 0) {
    return { success: false, count: 0 };
  }

  let count = 0;
  for (const obs of observations) {
    const date = new Date(obs.date);
    const value = parseFloat(obs.value);

    if (isNaN(value)) continue;

    try {
      await prisma.vixData.upsert({
        where: { date },
        update: { value },
        create: { date, value },
      });
      count++;
    } catch {
      // Skip duplicates
    }
  }

  console.log(`[FRED] Stored ${count} VIX observations`);
  return { success: true, count };
}

/**
 * Fetch and store US 2-Year yield data
 */
export async function updateUsYieldData(): Promise<{ success: boolean; count: number }> {
  console.log('[FRED] Fetching US 2Y yield data...');

  const observations = await fetchFredSeries(SERIES.US_2Y);

  if (observations.length === 0) {
    return { success: false, count: 0 };
  }

  let count = 0;
  for (const obs of observations) {
    const date = new Date(obs.date);
    const yield2Y = parseFloat(obs.value);

    if (isNaN(yield2Y)) continue;

    try {
      await prisma.yieldData.upsert({
        where: { currency_date: { currency: 'USD', date } },
        update: { yield2Y },
        create: { currency: 'USD', date, yield2Y },
      });
      count++;
    } catch {
      // Skip duplicates
    }
  }

  console.log(`[FRED] Stored ${count} US 2Y yield observations`);
  return { success: true, count };
}

/**
 * Fetch and store WTI Oil price (for CAD commodity tailwind)
 */
export async function updateOilData(): Promise<{ success: boolean; count: number }> {
  console.log('[FRED] Fetching WTI Oil data...');

  const observations = await fetchFredSeries(SERIES.OIL_WTI);

  if (observations.length === 0) {
    return { success: false, count: 0 };
  }

  let count = 0;
  for (const obs of observations) {
    const date = new Date(obs.date);
    const price = parseFloat(obs.value);

    if (isNaN(price)) continue;

    try {
      await prisma.commodityData.upsert({
        where: { commodity_date: { commodity: 'OIL_WTI', date } },
        update: { price },
        create: { commodity: 'OIL_WTI', date, price },
      });
      count++;
    } catch {
      // Skip duplicates
    }
  }

  console.log(`[FRED] Stored ${count} WTI Oil observations`);
  return { success: true, count };
}

/**
 * Fetch all FRED data
 */
export async function updateAllFredData(): Promise<{
  vix: { success: boolean; count: number };
  usYield: { success: boolean; count: number };
  oil: { success: boolean; count: number };
}> {
  console.log('[FRED] Starting data update...');

  const [vix, usYield, oil] = await Promise.all([
    updateVixData(),
    updateUsYieldData(),
    updateOilData(),
  ]);

  console.log('[FRED] Data update complete');

  return { vix, usYield, oil };
}

/**
 * Get latest VIX value and 90-day MA
 */
export async function getVixWithMa(): Promise<{
  current: number | null;
  ma90: number | null;
  trending: 'rising' | 'falling' | 'flat';
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const vixData = await prisma.vixData.findMany({
    where: { date: { gte: cutoff } },
    orderBy: { date: 'desc' },
    take: 90,
  });

  if (vixData.length === 0) {
    return { current: null, ma90: null, trending: 'flat' };
  }

  const current = vixData[0].value;
  const ma90 = vixData.reduce((sum, v) => sum + v.value, 0) / vixData.length;

  // Determine trend by comparing recent MA (20 days) vs older data
  let trending: 'rising' | 'falling' | 'flat' = 'flat';
  if (vixData.length >= 20) {
    const recent20 = vixData.slice(0, 20);
    const older20 = vixData.slice(20, 40);

    if (older20.length >= 10) {
      const recentAvg = recent20.reduce((sum, v) => sum + v.value, 0) / recent20.length;
      const olderAvg = older20.reduce((sum, v) => sum + v.value, 0) / older20.length;

      if (recentAvg > olderAvg * 1.05) trending = 'rising';
      else if (recentAvg < olderAvg * 0.95) trending = 'falling';
    }
  }

  return { current, ma90, trending };
}

/**
 * Check if FRED API is configured
 */
export function isConfigured(): boolean {
  return !!FRED_API_KEY;
}

/**
 * Clean up old data (keep 90 days)
 */
export async function cleanupOldData(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  await Promise.all([
    prisma.vixData.deleteMany({ where: { date: { lt: cutoff } } }),
    prisma.yieldData.deleteMany({ where: { date: { lt: cutoff } } }),
    prisma.commodityData.deleteMany({ where: { date: { lt: cutoff } } }),
  ]);

  console.log('[FRED] Cleaned up data older than 90 days');
}
