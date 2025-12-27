import prisma from '@/lib/prisma';
import type { AggregatedSentiment, SentimentFilters, OverviewCardData, ScrapedSentiment, CurrencyStrength, SignalChange, NewOverviewData, SignalLabel, RiskSentiment } from '@/types';
import { normalizeSymbol } from '@/lib/utils';
import { computeWeightedBlend, type SourceSnapshot } from '@/lib/sentiment/blend';
import { computeContrarian } from '@/lib/sentiment/contrarian';
import { CACHE } from '@/lib/constants';

// Major currencies for strength calculation
const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'];

// Get latest sentiment for all instruments
export async function getLatestSentiment(filters?: SentimentFilters): Promise<AggregatedSentiment[]> {
  // Get all instruments with optional filtering
  const instruments = await prisma.instrument.findMany({
    where: {
      ...(filters?.assetClass && { assetClass: filters.assetClass }),
      ...(filters?.search && {
        OR: [
          { symbol: { contains: filters.search } },
          { base: { contains: filters.search } },
          { quote: { contains: filters.search } },
        ],
      }),
    },
    orderBy: { symbol: 'asc' },
  });

  // Get all sources
  const sources = await prisma.sentimentSource.findMany({
    where: {
      isActive: true,
      ...(filters?.source && { name: filters.source }),
    },
  });

  // Only consider data from the last 24 hours to avoid stale source data
  const freshnessThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Build aggregated data for each instrument
  const result: AggregatedSentiment[] = [];

  for (const instrument of instruments) {
    const sourcesData: AggregatedSentiment['sources'] = [];
    let latestTimestamp = new Date(0);

    for (const source of sources) {
      // Get latest snapshot for this instrument from this source (within freshness window)
      const snapshot = await prisma.sentimentSnapshot.findFirst({
        where: {
          instrumentId: instrument.id,
          sourceId: source.id,
          timestamp: { gte: freshnessThreshold },
        },
        orderBy: { timestamp: 'desc' },
      });

      if (snapshot) {
        sourcesData.push({
          source,
          longPercent: snapshot.longPercent,
          shortPercent: snapshot.shortPercent,
          netSentiment: snapshot.netSentiment,
          timestamp: snapshot.timestamp,
        });

        if (snapshot.timestamp > latestTimestamp) {
          latestTimestamp = snapshot.timestamp;
        }
      }
    }

    // Only include instruments with at least one data point
    if (sourcesData.length > 0) {
      const avgLong = sourcesData.reduce((sum, s) => sum + s.longPercent, 0) / sourcesData.length;
      const avgShort = sourcesData.reduce((sum, s) => sum + s.shortPercent, 0) / sourcesData.length;

      // Build source snapshots for blending
      const blendInput: {
        myfxbook?: SourceSnapshot;
        oanda?: SourceSnapshot;
        dukascopy?: SourceSnapshot;
        forexfactory?: SourceSnapshot;
        fxblue?: SourceSnapshot;
      } = {};

      for (const sd of sourcesData) {
        const sourceName = sd.source.name.toLowerCase();
        const snapshot: SourceSnapshot = {
          longPercent: sd.longPercent,
          shortPercent: sd.shortPercent,
          timestamp: sd.timestamp,
        };

        if (sourceName === 'myfxbook') {
          blendInput.myfxbook = snapshot;
        } else if (sourceName === 'oanda') {
          blendInput.oanda = snapshot;
        } else if (sourceName === 'dukascopy') {
          blendInput.dukascopy = snapshot;
        } else if (sourceName === 'forexfactory') {
          blendInput.forexfactory = snapshot;
        } else if (sourceName === 'fxblue') {
          blendInput.fxblue = snapshot;
        }
      }

      // Compute weighted blend
      const blended = computeWeightedBlend(blendInput);

      result.push({
        instrument,
        sources: sourcesData,
        avgLongPercent: avgLong,
        avgShortPercent: avgShort,
        avgNetSentiment: avgLong - avgShort,
        blendedLong: blended.blendedLong,
        blendedShort: blended.blendedShort,
        blendedNet: blended.blendedLong - blended.blendedShort,
        sourcesUsed: blended.sourcesUsed,
        lastUpdated: latestTimestamp,
      });
    }
  }

  // Apply sorting
  if (filters?.sortBy) {
    const order = filters.sortOrder === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'symbol':
          return order * a.instrument.symbol.localeCompare(b.instrument.symbol);
        case 'longPercent':
          return order * (a.avgLongPercent - b.avgLongPercent);
        case 'shortPercent':
          return order * (a.avgShortPercent - b.avgShortPercent);
        case 'netSentiment':
          return order * (a.avgNetSentiment - b.avgNetSentiment);
        case 'lastUpdated':
          return order * (a.lastUpdated.getTime() - b.lastUpdated.getTime());
        default:
          return 0;
      }
    });
  }

  return result;
}

// Get overview card data
export async function getOverviewData(): Promise<OverviewCardData> {
  const sentiment = await getLatestSentiment({ assetClass: 'forex' });

  // Calculate average blended net sentiment
  const avgNet =
    sentiment.length > 0 ? sentiment.reduce((sum, s) => sum + s.blendedNet, 0) / sentiment.length : 0;

  // Determine risk sentiment based on blended values
  let riskSentiment: 'risk-on' | 'risk-off' | 'neutral' = 'neutral';
  if (avgNet > 5) riskSentiment = 'risk-on';
  else if (avgNet < -5) riskSentiment = 'risk-off';

  // Calculate contrarian signals for each pair and sort by signal strength
  const withContrarian = sentiment.map((s) => ({
    ...s,
    contrarian: computeContrarian(s.blendedLong, s.blendedShort),
  }));

  // Top Bullish: contrarian label is BULLISH, sorted by strength
  const bullish = withContrarian
    .filter((s) => s.contrarian.label === 'BULLISH')
    .sort((a, b) => b.contrarian.strength - a.contrarian.strength)
    .slice(0, 3)
    .map((s) => ({
      symbol: s.instrument.symbol,
      netSentiment: s.blendedNet,
    }));

  // Top Bearish: contrarian label is BEARISH, sorted by strength
  const bearish = withContrarian
    .filter((s) => s.contrarian.label === 'BEARISH')
    .sort((a, b) => b.contrarian.strength - a.contrarian.strength)
    .slice(0, 3)
    .map((s) => ({
      symbol: s.instrument.symbol,
      netSentiment: s.blendedNet,
    }));

  return {
    riskSentiment,
    topBullish: bullish,
    topBearish: bearish,
    averageNetSentiment: avgNet,
  };
}

// Save scraped sentiment data
export async function saveSentimentData(sourceName: string, data: ScrapedSentiment[]): Promise<number> {
  // Get source
  const source = await prisma.sentimentSource.findUnique({
    where: { name: sourceName },
  });

  if (!source) {
    throw new Error(`Source not found: ${sourceName}`);
  }

  let savedCount = 0;

  for (const item of data) {
    const normalizedSymbol = normalizeSymbol(item.symbol);
    let shouldInvertSentiment = false;

    // Find instrument - try multiple formats
    let targetInstrument = await prisma.instrument.findUnique({
      where: { symbol: normalizedSymbol },
    });

    if (!targetInstrument) {
      // Try reversed symbol (e.g., USD/CHF -> CHF/USD)
      const parts = normalizedSymbol.split('/');
      if (parts.length === 2) {
        const reversedSymbol = `${parts[1]}/${parts[0]}`;
        targetInstrument = await prisma.instrument.findUnique({
          where: { symbol: reversedSymbol },
        });
        if (targetInstrument) {
          // Symbol was reversed, so we need to invert sentiment
          // Being long EUR/AUD is equivalent to being short AUD/EUR
          shouldInvertSentiment = true;
        }
      }
    }

    if (!targetInstrument) {
      // Try without slash
      const noSlash = item.symbol.replace('/', '');
      targetInstrument = await prisma.instrument.findFirst({
        where: { symbol: noSlash },
      });
    }

    if (!targetInstrument) {
      // Try partial match on base currency
      const baseCurrency = normalizedSymbol.split('/')[0];
      if (baseCurrency && baseCurrency.length === 3) {
        const quoteCurrency = normalizedSymbol.split('/')[1];
        // First try exact match
        targetInstrument = await prisma.instrument.findFirst({
          where: { base: baseCurrency, quote: quoteCurrency },
        });
        // If not found, try reversed (and flag for inversion)
        if (!targetInstrument) {
          targetInstrument = await prisma.instrument.findFirst({
            where: { base: quoteCurrency, quote: baseCurrency },
          });
          if (targetInstrument) {
            shouldInvertSentiment = true;
          }
        }
      }
    }

    if (!targetInstrument) {
      console.warn(`Instrument not found: ${item.symbol} (normalized: ${normalizedSymbol})`);
      continue;
    }

    // Calculate sentiment values (invert if symbol was reversed)
    const longPercent = shouldInvertSentiment ? item.shortPercent : item.longPercent;
    const shortPercent = shouldInvertSentiment ? item.longPercent : item.shortPercent;

    // Create snapshot
    await prisma.sentimentSnapshot.create({
      data: {
        instrumentId: targetInstrument.id,
        sourceId: source.id,
        longPercent,
        shortPercent,
        netSentiment: longPercent - shortPercent,
      },
    });

    savedCount++;
  }

  return savedCount;
}

// Get distinct sources that have data
export async function getActiveSources(): Promise<string[]> {
  const sources = await prisma.sentimentSource.findMany({
    where: { isActive: true },
    select: { name: true },
  });

  return sources.map((s) => s.name);
}

// Clean up old snapshots (keep last 7 days)
export async function cleanupOldSnapshots(): Promise<number> {
  const retentionMs = CACHE.CLEANUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - retentionMs);

  const result = await prisma.sentimentSnapshot.deleteMany({
    where: {
      timestamp: { lt: cutoff },
    },
  });

  return result.count;
}

// Historical sentiment data point
export interface HistoricalDataPoint {
  date: string;
  blendedLong: number;
  blendedShort: number;
  sourcesUsed: string[];
}

// Get historical sentiment data for an instrument (daily aggregation)
export async function getHistoricalSentiment(
  symbol: string,
  interval: 'hourly' | 'daily' = 'daily',
  range: number = 14 // days for daily, hours for hourly
): Promise<{ instrument: { symbol: string; base: string; quote: string } | null; history: HistoricalDataPoint[] }> {
  // Find the instrument
  const instrument = await prisma.instrument.findUnique({
    where: { symbol },
    select: { id: true, symbol: true, base: true, quote: true },
  });

  if (!instrument) {
    return { instrument: null, history: [] };
  }

  // Calculate date range based on interval
  const endDate = new Date();
  const startDate = new Date();

  if (interval === 'hourly') {
    startDate.setHours(startDate.getHours() - range);
  } else {
    startDate.setDate(startDate.getDate() - range);
  }

  // Get all snapshots for this instrument within the date range
  const snapshots = await prisma.sentimentSnapshot.findMany({
    where: {
      instrumentId: instrument.id,
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      source: true,
    },
    orderBy: { timestamp: 'asc' },
  });

  // Group snapshots by time bucket (hour or day) and compute blended values
  const groupedData = new Map<string, { myfxbook?: SourceSnapshot; oanda?: SourceSnapshot; dukascopy?: SourceSnapshot; forexfactory?: SourceSnapshot; fxblue?: SourceSnapshot }>();

  for (const snapshot of snapshots) {
    // Create time bucket key based on interval
    let timeKey: string;
    if (interval === 'hourly') {
      // Format: YYYY-MM-DDTHH:00 (truncate to hour)
      timeKey = snapshot.timestamp.toISOString().slice(0, 13) + ':00';
    } else {
      // Format: YYYY-MM-DD (truncate to day)
      timeKey = snapshot.timestamp.toISOString().split('T')[0];
    }

    if (!groupedData.has(timeKey)) {
      groupedData.set(timeKey, {});
    }

    const bucketData = groupedData.get(timeKey)!;
    const sourceName = snapshot.source.name.toLowerCase();
    const sourceSnapshot: SourceSnapshot = {
      longPercent: snapshot.longPercent,
      shortPercent: snapshot.shortPercent,
      timestamp: snapshot.timestamp,
    };

    // Use the latest snapshot for each source per time bucket
    if (sourceName === 'myfxbook') {
      bucketData.myfxbook = sourceSnapshot;
    } else if (sourceName === 'oanda') {
      bucketData.oanda = sourceSnapshot;
    } else if (sourceName === 'dukascopy') {
      bucketData.dukascopy = sourceSnapshot;
    } else if (sourceName === 'forexfactory') {
      bucketData.forexfactory = sourceSnapshot;
    } else if (sourceName === 'fxblue') {
      bucketData.fxblue = sourceSnapshot;
    }
  }

  // Convert to array of historical data points
  const history: HistoricalDataPoint[] = [];

  for (const [date, sourceData] of Array.from(groupedData.entries())) {
    const blended = computeWeightedBlend(sourceData);
    history.push({
      date,
      blendedLong: blended.blendedLong,
      blendedShort: blended.blendedShort,
      sourcesUsed: blended.sourcesUsed,
    });
  }

  // Sort by date/time
  history.sort((a, b) => a.date.localeCompare(b.date));

  return { instrument, history };
}

/**
 * Compute currency strength from sentiment data
 * For each currency:
 * - When it's the BASE currency (first in pair), use blendedNet directly
 * - When it's the QUOTE currency (second in pair), invert blendedNet
 * - Average all values = currency strength
 */
export function computeCurrencyStrength(sentimentData: AggregatedSentiment[]): CurrencyStrength[] {
  const currencyScores: Record<string, number[]> = {};

  // Initialize scores for all major currencies
  for (const currency of MAJOR_CURRENCIES) {
    currencyScores[currency] = [];
  }

  for (const item of sentimentData) {
    const { base, quote } = item.instrument;
    const blendedNet = item.blendedNet;

    // Add score for base currency (direct)
    if (currencyScores[base]) {
      currencyScores[base].push(blendedNet);
    }

    // Add score for quote currency (inverted)
    if (currencyScores[quote]) {
      currencyScores[quote].push(-blendedNet);
    }
  }

  // Calculate average strength for each currency
  const result: CurrencyStrength[] = [];

  for (const currency of MAJOR_CURRENCIES) {
    const scores = currencyScores[currency];
    if (scores.length > 0) {
      const avgStrength = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      result.push({
        currency,
        strength: Math.round(avgStrength * 10) / 10, // Round to 1 decimal
      });
    } else {
      result.push({
        currency,
        strength: 0,
      });
    }
  }

  // Sort by strength (strongest first)
  result.sort((a, b) => b.strength - a.strength);

  return result;
}

/**
 * Get signal changes by comparing current data with historical data
 * - New Signal: was NEUTRAL, now BULLISH/BEARISH
 * - Fading Signal: was strong (>=25pp), dropped by >=10pp or became NEUTRAL
 */
export async function getSignalChanges(currentData: AggregatedSentiment[]): Promise<{ newSignals: SignalChange[]; fadingSignals: SignalChange[] }> {
  const newSignals: SignalChange[] = [];
  const fadingSignals: SignalChange[] = [];

  // Get data from 24 hours ago for comparison
  const comparisonTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const current of currentData) {
    // Get historical snapshots for this instrument around 24 hours ago
    const historicalSnapshots = await prisma.sentimentSnapshot.findMany({
      where: {
        instrumentId: current.instrument.id,
        timestamp: {
          gte: new Date(comparisonTime.getTime() - 30 * 60 * 1000), // 30 min window
          lte: new Date(comparisonTime.getTime() + 30 * 60 * 1000),
        },
      },
      include: { source: true },
    });

    if (historicalSnapshots.length === 0) {
      continue;
    }

    // Build blended historical values
    const historicalInput: {
      myfxbook?: SourceSnapshot;
      oanda?: SourceSnapshot;
      dukascopy?: SourceSnapshot;
      forexfactory?: SourceSnapshot;
      fxblue?: SourceSnapshot;
    } = {};

    for (const snapshot of historicalSnapshots) {
      const sourceName = snapshot.source.name.toLowerCase();
      const sourceSnapshot: SourceSnapshot = {
        longPercent: snapshot.longPercent,
        shortPercent: snapshot.shortPercent,
        timestamp: snapshot.timestamp,
      };

      if (sourceName === 'myfxbook') historicalInput.myfxbook = sourceSnapshot;
      else if (sourceName === 'oanda') historicalInput.oanda = sourceSnapshot;
      else if (sourceName === 'dukascopy') historicalInput.dukascopy = sourceSnapshot;
      else if (sourceName === 'forexfactory') historicalInput.forexfactory = sourceSnapshot;
      else if (sourceName === 'fxblue') historicalInput.fxblue = sourceSnapshot;
    }

    const historicalBlended = computeWeightedBlend(historicalInput);
    const previousContrarian = computeContrarian(historicalBlended.blendedLong, historicalBlended.blendedShort);
    const currentContrarian = computeContrarian(current.blendedLong, current.blendedShort);

    const previousLabel = previousContrarian.label as SignalLabel;
    const currentLabel = currentContrarian.label as SignalLabel;

    // Check for new signal: was NEUTRAL, now has a signal
    if (previousLabel === 'NEUTRAL' && currentLabel !== 'NEUTRAL') {
      newSignals.push({
        symbol: current.instrument.symbol,
        previousLabel,
        currentLabel,
        previousStrength: previousContrarian.strength,
        currentStrength: currentContrarian.strength,
        changeType: 'new',
      });
    }

    // Check for fading signal: was strong, now weaker or neutral
    if (previousLabel !== 'NEUTRAL' && previousContrarian.strength >= 25) {
      const strengthDrop = previousContrarian.strength - currentContrarian.strength;
      if (currentLabel === 'NEUTRAL' || strengthDrop >= 10) {
        fadingSignals.push({
          symbol: current.instrument.symbol,
          previousLabel,
          currentLabel,
          previousStrength: previousContrarian.strength,
          currentStrength: currentContrarian.strength,
          changeType: 'fading',
        });
      }
    }
  }

  // Sort by strength change magnitude and return top 5 of each
  newSignals.sort((a, b) => b.currentStrength - a.currentStrength);
  fadingSignals.sort((a, b) => (b.previousStrength - b.currentStrength) - (a.previousStrength - a.currentStrength));

  return {
    newSignals: newSignals.slice(0, 5),
    fadingSignals: fadingSignals.slice(0, 5),
  };
}

// Currency classifications for risk sentiment
const RISK_CURRENCIES = ['AUD', 'NZD', 'CAD'];
const SAFE_HAVEN_CURRENCIES = ['JPY', 'CHF'];

/**
 * Compute risk sentiment from currency strength data
 * Risk-on: risk currencies stronger than safe havens
 * Risk-off: safe havens stronger than risk currencies
 */
export function computeRiskSentiment(currencyStrength: CurrencyStrength[]): RiskSentiment {
  // Find strength values for each category
  const riskStrengths = currencyStrength
    .filter(c => RISK_CURRENCIES.includes(c.currency))
    .map(c => c.strength);

  const safeHavenStrengths = currencyStrength
    .filter(c => SAFE_HAVEN_CURRENCIES.includes(c.currency))
    .map(c => c.strength);

  // Calculate averages
  const riskScore = riskStrengths.length > 0
    ? riskStrengths.reduce((sum, s) => sum + s, 0) / riskStrengths.length
    : 0;

  const safeHavenScore = safeHavenStrengths.length > 0
    ? safeHavenStrengths.reduce((sum, s) => sum + s, 0) / safeHavenStrengths.length
    : 0;

  // Calculate delta: positive = risk-on, negative = risk-off
  const delta = riskScore - safeHavenScore;

  // Determine status with threshold of 5
  let status: RiskSentiment['status'] = 'NEUTRAL';
  if (delta > 5) {
    status = 'RISK-ON';
  } else if (delta < -5) {
    status = 'RISK-OFF';
  }

  return {
    status,
    riskScore: Math.round(riskScore * 10) / 10,
    safeHavenScore: Math.round(safeHavenScore * 10) / 10,
    delta: Math.round(delta * 10) / 10,
  };
}

/**
 * Get all new overview data for dashboard cards
 */
export async function getNewOverviewData(): Promise<NewOverviewData> {
  // Get current sentiment data for forex pairs only
  const sentimentData = await getLatestSentiment({ assetClass: 'forex' });

  // Compute currency strength first (needed for risk sentiment)
  const currencyStrength = computeCurrencyStrength(sentimentData);

  // Compute all data in parallel where possible
  const [signalChanges] = await Promise.all([
    getSignalChanges(sentimentData),
  ]);

  return {
    currencyStrength,
    riskSentiment: computeRiskSentiment(currencyStrength),
    newSignals: signalChanges.newSignals,
    fadingSignals: signalChanges.fadingSignals,
  };
}
