/**
 * Weighted Blended Sentiment
 *
 * Combines sentiment from multiple sources with weights:
 * - Myfxbook: weight 2
 * - OANDA: weight 2
 * - Dukascopy: weight 1
 * - ForexFactory: weight 1
 * - FXBlue: weight 1
 *
 * Only available sources are used in the calculation.
 */

export interface SourceSnapshot {
  longPercent: number;
  shortPercent: number;
  timestamp?: Date | string;
}

export interface BlendedResult {
  blendedLong: number;
  blendedShort: number;
  weightsUsed: {
    M: number;
    O: number;
    D: number;
    F: number;
    X: number;
  };
  sourcesUsed: ('myfxbook' | 'oanda' | 'dukascopy' | 'forexfactory' | 'fxblue')[];
  totalWeight: number;
}

// Source weights
const WEIGHTS = {
  myfxbook: 2,
  oanda: 2,
  dukascopy: 1,
  forexfactory: 1,
  fxblue: 1,
} as const;

export interface BlendInput {
  myfxbook?: SourceSnapshot | null;
  oanda?: SourceSnapshot | null;
  dukascopy?: SourceSnapshot | null;
  forexfactory?: SourceSnapshot | null;
  fxblue?: SourceSnapshot | null;
}

/**
 * Compute weighted blended sentiment across all available sources
 *
 * @param sources - Object containing optional snapshots from each source
 * @returns BlendedResult with weighted averages and metadata
 *
 * @example
 * // Myfxbook: 80% long, OANDA: 70% long, Dukascopy: 60% long
 * // blended_long = (2*80 + 2*70 + 1*60) / (2+2+1) = 360/5 = 72%
 * computeWeightedBlend({
 *   myfxbook: { longPercent: 80, shortPercent: 20 },
 *   oanda: { longPercent: 70, shortPercent: 30 },
 *   dukascopy: { longPercent: 60, shortPercent: 40 },
 * })
 * // Returns: { blendedLong: 72, blendedShort: 28, ... }
 */
export function computeWeightedBlend(sources: BlendInput): BlendedResult {
  let weightedSum = 0;
  let totalWeight = 0;
  const sourcesUsed: ('myfxbook' | 'oanda' | 'dukascopy' | 'forexfactory' | 'fxblue')[] = [];
  const weightsUsed = { M: 0, O: 0, D: 0, F: 0, X: 0 };

  // Process Myfxbook
  if (sources.myfxbook && isValidSnapshot(sources.myfxbook)) {
    weightedSum += WEIGHTS.myfxbook * sources.myfxbook.longPercent;
    totalWeight += WEIGHTS.myfxbook;
    sourcesUsed.push('myfxbook');
    weightsUsed.M = WEIGHTS.myfxbook;
  }

  // Process OANDA
  if (sources.oanda && isValidSnapshot(sources.oanda)) {
    weightedSum += WEIGHTS.oanda * sources.oanda.longPercent;
    totalWeight += WEIGHTS.oanda;
    sourcesUsed.push('oanda');
    weightsUsed.O = WEIGHTS.oanda;
  }

  // Process Dukascopy
  if (sources.dukascopy && isValidSnapshot(sources.dukascopy)) {
    weightedSum += WEIGHTS.dukascopy * sources.dukascopy.longPercent;
    totalWeight += WEIGHTS.dukascopy;
    sourcesUsed.push('dukascopy');
    weightsUsed.D = WEIGHTS.dukascopy;
  }

  // Process ForexFactory
  if (sources.forexfactory && isValidSnapshot(sources.forexfactory)) {
    weightedSum += WEIGHTS.forexfactory * sources.forexfactory.longPercent;
    totalWeight += WEIGHTS.forexfactory;
    sourcesUsed.push('forexfactory');
    weightsUsed.F = WEIGHTS.forexfactory;
  }

  // Process FXBlue
  if (sources.fxblue && isValidSnapshot(sources.fxblue)) {
    weightedSum += WEIGHTS.fxblue * sources.fxblue.longPercent;
    totalWeight += WEIGHTS.fxblue;
    sourcesUsed.push('fxblue');
    weightsUsed.X = WEIGHTS.fxblue;
  }

  // If no sources available, return 50/50
  if (totalWeight === 0) {
    return {
      blendedLong: 50,
      blendedShort: 50,
      weightsUsed,
      sourcesUsed,
      totalWeight: 0,
    };
  }

  const blendedLong = weightedSum / totalWeight;
  const blendedShort = 100 - blendedLong;

  return {
    blendedLong: Math.round(blendedLong * 100) / 100, // Round to 2 decimals
    blendedShort: Math.round(blendedShort * 100) / 100,
    weightsUsed,
    sourcesUsed,
    totalWeight,
  };
}

/**
 * Check if a snapshot has valid data
 */
function isValidSnapshot(snapshot: SourceSnapshot): boolean {
  return (
    typeof snapshot.longPercent === 'number' &&
    typeof snapshot.shortPercent === 'number' &&
    !isNaN(snapshot.longPercent) &&
    !isNaN(snapshot.shortPercent)
  );
}

/**
 * Get source badge abbreviation
 */
export function getSourceBadge(source: string): string {
  switch (source.toLowerCase()) {
    case 'myfxbook':
      return 'M';
    case 'oanda':
      return 'O';
    case 'dukascopy':
      return 'D';
    case 'forexfactory':
      return 'F';
    case 'fxblue':
      return 'X';
    default:
      return source.charAt(0).toUpperCase();
  }
}

/**
 * Get all possible source names
 */
export function getAllSources(): ('myfxbook' | 'oanda' | 'dukascopy' | 'forexfactory' | 'fxblue')[] {
  return ['myfxbook', 'oanda', 'dukascopy', 'forexfactory', 'fxblue'];
}

/**
 * Get weight for a specific source
 */
export function getSourceWeight(source: string): number {
  return WEIGHTS[source.toLowerCase() as keyof typeof WEIGHTS] ?? 0;
}
