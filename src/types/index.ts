import type { Instrument, SentimentSource, SentimentSnapshot } from '@prisma/client';

// Re-export Prisma types
export type { Instrument, SentimentSource, SentimentSnapshot, User } from '@prisma/client';

// Sentiment data with relations
export interface SentimentData extends SentimentSnapshot {
  instrument: Instrument;
  source: SentimentSource;
}

// Aggregated sentiment for an instrument (latest from each source)
export interface AggregatedSentiment {
  instrument: Instrument;
  sources: {
    source: SentimentSource;
    longPercent: number;
    shortPercent: number;
    netSentiment: number;
    timestamp: Date;
  }[];
  // Simple average (legacy)
  avgLongPercent: number;
  avgShortPercent: number;
  avgNetSentiment: number;
  // Weighted blended values (M=2, O=2, D=1)
  blendedLong: number;
  blendedShort: number;
  blendedNet: number;
  sourcesUsed: string[];
  lastUpdated: Date;
}

// Matrix cell data for forex pair sentiment
export interface MatrixCell {
  base: string;
  quote: string;
  symbol: string;
  netSentiment: number | null;
  longPercent: number | null;
  shortPercent: number | null;
  hasData: boolean;
}

// Scraper result type
export interface ScraperResult {
  success: boolean;
  source: string;
  data: ScrapedSentiment[];
  error?: string;
  timestamp: Date;
}

// Scraped sentiment data (before DB normalization)
export interface ScrapedSentiment {
  symbol: string;
  longPercent: number;
  shortPercent: number;
}

// API response types
export interface SentimentResponse {
  data: AggregatedSentiment[];
  meta: {
    total: number;
    sources: string[];
    lastUpdated: string;
  };
}

// Filter options for sentiment query
export interface SentimentFilters {
  search?: string;
  source?: string;
  assetClass?: string;
  sortBy?: 'symbol' | 'longPercent' | 'shortPercent' | 'netSentiment' | 'lastUpdated';
  sortOrder?: 'asc' | 'desc';
}

// Overview card data (legacy)
export interface OverviewCardData {
  riskSentiment: 'risk-on' | 'risk-off' | 'neutral';
  topBullish: { symbol: string; netSentiment: number }[];
  topBearish: { symbol: string; netSentiment: number }[];
  averageNetSentiment: number;
}

// New overview card types
export interface CurrencyStrength {
  currency: string;
  strength: number; // -100 to +100
}

export type SignalLabel = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface SignalChange {
  symbol: string;
  previousLabel: SignalLabel;
  currentLabel: SignalLabel;
  previousStrength: number;
  currentStrength: number;
  changeType: 'new' | 'fading';
}

export type RiskStatus = 'RISK-ON' | 'RISK-OFF' | 'NEUTRAL';

export interface RiskSentiment {
  status: RiskStatus;
  riskScore: number;      // AUD, NZD, CAD average
  safeHavenScore: number; // JPY, CHF average
  delta: number;          // riskScore - safeHavenScore
}

export interface NewOverviewData {
  currencyStrength: CurrencyStrength[];
  riskSentiment: RiskSentiment;
  newSignals: SignalChange[];
  fadingSignals: SignalChange[];
}

// Auth types
export interface SignUpData {
  email: string;
  password: string;
  name?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

// Session user type (for NextAuth)
export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
}

// Myfxbook API types
export interface MyfxbookLoginResponse {
  error: boolean;
  message: string;
  session?: string;
}

export interface MyfxbookOutlookResponse {
  error: boolean;
  message: string;
  symbols?: MyfxbookSymbol[];
}

export interface MyfxbookSymbol {
  name: string;
  shortPercentage: number;
  longPercentage: number;
}
