/**
 * Fundamental Analysis Service
 * Handles currency scoring, pair biases, and data management
 */

import { prisma } from '@/lib/prisma';
import type { FundamentalCurrency, FundamentalSettings } from '@prisma/client';

// Currency list
export const CURRENCIES = ['AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'JPY', 'NZD', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

// Forex pairs for bias calculation
export const FOREX_PAIRS = [
  { pair: 'EUR/USD', base: 'EUR', quote: 'USD' },
  { pair: 'GBP/USD', base: 'GBP', quote: 'USD' },
  { pair: 'USD/JPY', base: 'USD', quote: 'JPY' },
  { pair: 'AUD/USD', base: 'AUD', quote: 'USD' },
  { pair: 'NZD/USD', base: 'NZD', quote: 'USD' },
  { pair: 'USD/CAD', base: 'USD', quote: 'CAD' },
  { pair: 'USD/CHF', base: 'USD', quote: 'CHF' },
  { pair: 'EUR/GBP', base: 'EUR', quote: 'GBP' },
  { pair: 'EUR/JPY', base: 'EUR', quote: 'JPY' },
  { pair: 'GBP/JPY', base: 'GBP', quote: 'JPY' },
  { pair: 'AUD/NZD', base: 'AUD', quote: 'NZD' },
  { pair: 'AUD/JPY', base: 'AUD', quote: 'JPY' },
  { pair: 'EUR/CAD', base: 'EUR', quote: 'CAD' },
  { pair: 'EUR/AUD', base: 'EUR', quote: 'AUD' },
  { pair: 'AUD/CAD', base: 'AUD', quote: 'CAD' },
  { pair: 'EUR/NZD', base: 'EUR', quote: 'NZD' },
  { pair: 'GBP/NZD', base: 'GBP', quote: 'NZD' },
  { pair: 'EUR/CHF', base: 'EUR', quote: 'CHF' },
  { pair: 'CHF/JPY', base: 'CHF', quote: 'JPY' },
  { pair: 'GBP/CHF', base: 'GBP', quote: 'CHF' },
  { pair: 'NZD/CHF', base: 'NZD', quote: 'CHF' },
  { pair: 'GBP/CAD', base: 'GBP', quote: 'CAD' },
  { pair: 'GBP/AUD', base: 'GBP', quote: 'AUD' },
  { pair: 'AUD/CHF', base: 'AUD', quote: 'CHF' },
  { pair: 'NZD/JPY', base: 'NZD', quote: 'JPY' },
  { pair: 'NZD/CAD', base: 'NZD', quote: 'CAD' },
  { pair: 'CAD/JPY', base: 'CAD', quote: 'JPY' },
  { pair: 'CAD/CHF', base: 'CAD', quote: 'CHF' },
] as const;

// Risk adjustments by currency (small overlay, max ±0.5)
// Risk is meaningful but never dominant over core factors
const RISK_ADJUSTMENTS: Record<Currency, { riskOn: number; riskOff: number }> = {
  AUD: { riskOn: 0.5, riskOff: -0.5 },
  CAD: { riskOn: 0.25, riskOff: -0.25 },  // Smaller due to oil correlation
  CHF: { riskOn: -0.5, riskOff: 0.5 },
  EUR: { riskOn: 0, riskOff: 0 },
  GBP: { riskOn: 0, riskOff: 0 },
  JPY: { riskOn: -0.5, riskOff: 0.5 },
  NZD: { riskOn: 0.5, riskOff: -0.5 },
  USD: { riskOn: -0.5, riskOff: 0.5 },
};

// Score mappings
type InflationTrend = 'Up' | 'Flat' | 'Down';
type PMISignal = 'Up' | 'Flat' | 'Down';
type CentralBankTone = 'Hawkish' | 'Neutral' | 'Dovish';
type RateDifferential = 'Up' | 'Flat' | 'Down';
type CommodityTailwind = 'Yes' | 'Neutral' | 'No';
type RiskRegime = 'Risk-on' | 'Neutral' | 'Risk-off';

// Score mappings - Note: rateDiff has 2x weight in baseScore calculation
const SCORE_MAP = {
  // Inflation: Up = bullish (higher rates support currency)
  inflation: { Up: 1, Flat: 0, Down: -1 },
  // PMI: Up = bullish (economic expansion)
  pmi: { Up: 1, Flat: 0, Down: -1 },
  // Central Bank: Hawkish = bullish (higher rates)
  centralBank: { Hawkish: 1, Neutral: 0, Dovish: -1 },
  // Rate Differential (2Y Yield Diff): Positive = bullish (higher yield attracts capital)
  // Note: Now rule-based using MA20 vs MA60 of yield differential
  rateDiff: { Positive: 1, Flat: 0, Negative: -1, Up: 1, Down: -1 },
  // Commodity: Yes = bullish for commodity currencies
  commodity: { Yes: 1, Neutral: 0, No: -1 },
} as const;

// Weight multipliers for scoring
const SCORE_WEIGHTS = {
  inflation: 1,
  pmi: 1,
  centralBank: 1,
  rateDiff: 2,  // 2x weight for yield differential
} as const;

export interface PairBias {
  pair: string;
  base: string;
  quote: string;
  score: number;
  rating: 'Bullish' | 'Neutral' | 'Bearish';
}

export interface CurrencyScore {
  currency: string;
  inflationTrend: string;
  pmiSignal: string;
  centralBankTone: string;
  rateDifferential: string;
  commodityTailwind: string;
  cpiActual: number | null;
  cpiPrevious: number | null;
  pmiActual: number | null;
  pmiPrevious: number | null;
  // New yield data fields
  yield2Y: number | null;
  yieldDiffVsUsd: number | null;
  yieldDiffMa20: number | null;
  yieldDiffMa60: number | null;
  // Commodity basket data
  commodityBasket: number | null;
  commodityMa90: number | null;
  // Scores
  baseScore: number;
  commodityAdj: number;
  riskAdj: number;
  totalScore: number;
  rating: string;
  aiJustification: string | null;
  manualOverride: boolean;
  lastUpdated: Date;
  updatedBy: string | null;
}

/**
 * Calculate scores for a currency based on its indicators
 * Uses global riskRegime from settings to apply risk adjustments
 *
 * Risk adjustments (from Excel):
 * - Risk-on:  AUD/CAD/NZD get +1, CHF/JPY/USD get -1, EUR/GBP get 0
 * - Risk-off: AUD/CAD/NZD get -1, CHF/JPY/USD get +1, EUR/GBP get 0
 */
export function calculateScores(
  currency: Partial<FundamentalCurrency>,
  riskRegime: RiskRegime = 'Neutral',
  thresholds: { bullish: number; bearish: number } = { bullish: 3, bearish: -3 }
): { baseScore: number; commodityAdj: number; riskAdj: number; totalScore: number; rating: string } {
  // Base score from 5 indicators with weights
  // Yield differential (rateDiff) has 2x weight
  const inflationScore = (SCORE_MAP.inflation[currency.inflationTrend as InflationTrend] ?? 0) * SCORE_WEIGHTS.inflation;
  const pmiScore = (SCORE_MAP.pmi[currency.pmiSignal as PMISignal] ?? 0) * SCORE_WEIGHTS.pmi;
  const cbScore = (SCORE_MAP.centralBank[currency.centralBankTone as CentralBankTone] ?? 0) * SCORE_WEIGHTS.centralBank;
  const rateScore = (SCORE_MAP.rateDiff[currency.rateDifferential as keyof typeof SCORE_MAP.rateDiff] ?? 0) * SCORE_WEIGHTS.rateDiff;

  const baseScore = inflationScore + pmiScore + cbScore + rateScore;

  // Commodity adjustment
  const commodityAdj = SCORE_MAP.commodity[currency.commodityTailwind as CommodityTailwind] ?? 0;

  // Risk adjustment based on global risk regime
  const currencyCode = currency.currency as Currency;
  let riskAdj = 0;

  if (riskRegime === 'Risk-on') {
    riskAdj = RISK_ADJUSTMENTS[currencyCode]?.riskOn ?? 0;
  } else if (riskRegime === 'Risk-off') {
    riskAdj = RISK_ADJUSTMENTS[currencyCode]?.riskOff ?? 0;
  }

  const totalScore = baseScore + commodityAdj + riskAdj;

  // Rating based on thresholds
  let rating = 'Neutral';
  if (totalScore >= thresholds.bullish) {
    rating = 'Bullish';
  } else if (totalScore <= thresholds.bearish) {
    rating = 'Bearish';
  }

  return { baseScore, commodityAdj, riskAdj, totalScore, rating };
}

/**
 * Calculate pair biases from currency scores
 */
export function calculatePairBiases(
  currencies: Map<string, number> // currency -> totalScore
): PairBias[] {
  return FOREX_PAIRS.map(({ pair, base, quote }) => {
    const baseScore = currencies.get(base) ?? 0;
    const quoteScore = currencies.get(quote) ?? 0;
    const score = baseScore - quoteScore;

    let rating: 'Bullish' | 'Neutral' | 'Bearish' = 'Neutral';
    if (score > 1) rating = 'Bullish';
    else if (score < -1) rating = 'Bearish';

    return { pair, base, quote, score, rating };
  });
}

/**
 * Get or create settings
 */
export async function getSettings(): Promise<FundamentalSettings> {
  let settings = await prisma.fundamentalSettings.findFirst();
  if (!settings) {
    settings = await prisma.fundamentalSettings.create({
      data: {
        bullishThreshold: 3,
        bearishThreshold: -3,
        riskRegime: 'Neutral',
      },
    });
  }
  return settings;
}

/**
 * Update settings
 */
export async function updateSettings(data: {
  bullishThreshold?: number;
  bearishThreshold?: number;
  riskRegime?: string;
  riskSentimentJustification?: string;
}): Promise<FundamentalSettings> {
  const settings = await getSettings();
  return prisma.fundamentalSettings.update({
    where: { id: settings.id },
    data: {
      ...data,
      lastUpdated: new Date(),
    },
  });
}

/**
 * Get all currency data with calculated scores
 */
export async function getAllCurrencies(): Promise<CurrencyScore[]> {
  const settings = await getSettings();

  // Ensure all currencies exist
  await ensureAllCurrenciesExist();

  const currencies = await prisma.fundamentalCurrency.findMany({
    orderBy: { currency: 'asc' },
  });

  // Recalculate scores with current settings
  return currencies.map((c) => {
    const scores = calculateScores(
      c,
      settings.riskRegime as RiskRegime,
      { bullish: settings.bullishThreshold, bearish: settings.bearishThreshold }
    );

    return {
      currency: c.currency,
      inflationTrend: c.inflationTrend,
      pmiSignal: c.pmiSignal,
      centralBankTone: c.centralBankTone,
      rateDifferential: c.rateDifferential,
      commodityTailwind: c.commodityTailwind,
      cpiActual: c.cpiActual,
      cpiPrevious: c.cpiPrevious,
      pmiActual: c.pmiActual,
      pmiPrevious: c.pmiPrevious,
      // New yield data fields
      yield2Y: c.yield2Y,
      yieldDiffVsUsd: c.yieldDiffVsUsd,
      yieldDiffMa20: c.yieldDiffMa20,
      yieldDiffMa60: c.yieldDiffMa60,
      // Commodity basket data
      commodityBasket: c.commodityBasket,
      commodityMa90: c.commodityMa90,
      ...scores,
      aiJustification: c.aiJustification,
      manualOverride: c.manualOverride,
      lastUpdated: c.lastUpdated,
      updatedBy: c.updatedBy,
    };
  });
}

/**
 * Ensure all 8 currencies exist in database
 */
export async function ensureAllCurrenciesExist(): Promise<void> {
  const existing = await prisma.fundamentalCurrency.findMany({
    select: { currency: true },
  });
  const existingSet = new Set(existing.map((c) => c.currency));

  const missing = CURRENCIES.filter((c) => !existingSet.has(c));
  if (missing.length > 0) {
    await prisma.fundamentalCurrency.createMany({
      data: missing.map((currency) => ({ currency })),
    });
  }
}

/**
 * Get pair biases for all forex pairs
 */
export async function getPairBiases(): Promise<PairBias[]> {
  const currencies = await getAllCurrencies();
  const scoreMap = new Map(currencies.map((c) => [c.currency, c.totalScore]));
  return calculatePairBiases(scoreMap);
}

/**
 * Update a single currency's indicators
 */
export async function updateCurrency(
  currency: string,
  data: {
    inflationTrend?: string;
    pmiSignal?: string;
    centralBankTone?: string;
    rateDifferential?: string;
    commodityTailwind?: string;
    aiJustification?: string;
    manualOverride?: boolean;
    updatedBy?: string;
  }
): Promise<FundamentalCurrency> {
  const settings = await getSettings();

  // Calculate new scores
  const current = await prisma.fundamentalCurrency.findUnique({
    where: { currency },
  });

  const merged = { ...current, ...data };
  const scores = calculateScores(
    merged,
    settings.riskRegime as RiskRegime,
    { bullish: settings.bullishThreshold, bearish: settings.bearishThreshold }
  );

  // Save history snapshot
  if (current) {
    await prisma.fundamentalHistory.create({
      data: {
        currency,
        snapshot: current as object,
        source: data.updatedBy ?? 'unknown',
      },
    });
  }

  return prisma.fundamentalCurrency.update({
    where: { currency },
    data: {
      ...data,
      baseScore: scores.baseScore,
      commodityAdj: scores.commodityAdj,
      riskAdj: scores.riskAdj,
      totalScore: scores.totalScore,
      rating: scores.rating,
      lastUpdated: new Date(),
    },
  });
}

/**
 * Bulk update all currencies (used by AI analysis)
 */
export async function bulkUpdateCurrencies(
  updates: Array<{
    currency: string;
    inflationTrend?: string;
    pmiSignal?: string;
    centralBankTone?: string;
    rateDifferential?: string;
    commodityTailwind?: string;
    aiJustification?: string;
  }>,
  source: string = 'AI'
): Promise<void> {
  const settings = await getSettings();

  for (const update of updates) {
    // Skip currencies with manual override
    const current = await prisma.fundamentalCurrency.findUnique({
      where: { currency: update.currency },
    });

    if (current?.manualOverride) {
      continue; // Don't overwrite manual overrides
    }

    await updateCurrency(update.currency, {
      ...update,
      updatedBy: source,
    });
  }
}

/**
 * Get history for a currency
 */
export async function getCurrencyHistory(
  currency: string,
  limit: number = 20
): Promise<Array<{ id: string; snapshot: unknown; source: string; createdAt: Date }>> {
  return prisma.fundamentalHistory.findMany({
    where: { currency },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Recalculate all scores (called when settings change)
 */
export async function recalculateAllScores(): Promise<void> {
  const settings = await getSettings();
  const currencies = await prisma.fundamentalCurrency.findMany();

  for (const currency of currencies) {
    const scores = calculateScores(
      currency,
      settings.riskRegime as RiskRegime,
      { bullish: settings.bullishThreshold, bearish: settings.bearishThreshold }
    );

    await prisma.fundamentalCurrency.update({
      where: { id: currency.id },
      data: {
        baseScore: scores.baseScore,
        commodityAdj: scores.commodityAdj,
        riskAdj: scores.riskAdj,
        totalScore: scores.totalScore,
        rating: scores.rating,
      },
    });
  }
}
