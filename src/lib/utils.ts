import { SENTIMENT_THRESHOLDS } from './constants';

// Format percentage with sign
export function formatPercent(value: number, decimals = 1): string {
  const formatted = Math.abs(value).toFixed(decimals);
  return value >= 0 ? `+${formatted}%` : `-${formatted}%`;
}

// Format percentage without sign
export function formatPercentUnsigned(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// Get sentiment label from net value
export function getSentimentLabel(net: number): 'strong-bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong-bearish' {
  if (net >= SENTIMENT_THRESHOLDS.STRONG_BULLISH) return 'strong-bullish';
  if (net >= SENTIMENT_THRESHOLDS.BULLISH) return 'bullish';
  if (net >= SENTIMENT_THRESHOLDS.NEUTRAL) return 'neutral';
  if (net >= SENTIMENT_THRESHOLDS.BEARISH) return 'bearish';
  return 'strong-bearish';
}

// Get CSS class for sentiment coloring
export function getSentimentColor(net: number): string {
  const label = getSentimentLabel(net);
  switch (label) {
    case 'strong-bullish':
      return 'text-sentiment-bullish font-semibold';
    case 'bullish':
      return 'text-sentiment-bullish';
    case 'neutral':
      return 'text-sentiment-neutral';
    case 'bearish':
      return 'text-sentiment-bearish';
    case 'strong-bearish':
      return 'text-sentiment-bearish font-semibold';
  }
}

// Get background color for matrix cells
export function getSentimentBgColor(net: number): string {
  // Gradient from red (-100) to green (+100)
  // Neutral is around 0
  if (net >= 20) return 'bg-green-600/40';
  if (net >= 10) return 'bg-green-600/30';
  if (net >= 5) return 'bg-green-600/20';
  if (net >= -5) return 'bg-yellow-600/20';
  if (net >= -10) return 'bg-red-600/20';
  if (net >= -20) return 'bg-red-600/30';
  return 'bg-red-600/40';
}

// Format relative time
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// Normalize symbol format (e.g., "EURUSD" -> "EUR/USD")
export function normalizeSymbol(symbol: string): string {
  // Already has separator
  if (symbol.includes('/') || symbol.includes('_') || symbol.includes('-')) {
    return symbol.replace(/[_-]/g, '/');
  }

  // Try to split 6-char forex pairs
  if (symbol.length === 6) {
    return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  }

  return symbol;
}

// Debounce function
export function debounce<T extends (...args: never[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Simple in-memory cache
export class SimpleCache<T> {
  private cache = new Map<string, { value: T; expires: number }>();

  set(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlMs,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Rate limiter for scrapers
export class RateLimiter {
  private lastCall = new Map<string, number>();

  canCall(key: string, cooldownMs: number): boolean {
    const last = this.lastCall.get(key);
    if (!last) return true;
    return Date.now() - last >= cooldownMs;
  }

  record(key: string): void {
    this.lastCall.set(key, Date.now());
  }

  getTimeUntilReady(key: string, cooldownMs: number): number {
    const last = this.lastCall.get(key);
    if (!last) return 0;
    const elapsed = Date.now() - last;
    return Math.max(0, cooldownMs - elapsed);
  }
}

// Logger utility
export const logger = {
  info: (message: string, data?: unknown) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ?? '');
  },
  warn: (message: string, data?: unknown) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data ?? '');
  },
  error: (message: string, error?: unknown) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error ?? '');
  },
  debug: (message: string, data?: unknown) => {
    if (process.env.DEBUG_SCRAPERS === 'true') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, data ?? '');
    }
  },
};
