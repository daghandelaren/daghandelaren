'use client';

import { computeContrarian, type ContrarianLabel } from '@/lib/sentiment/contrarian';
import { getAllSources, getSourceBadge } from '@/lib/sentiment/blend';

interface SourceData {
  name: string;
  longPercent: number;
  shortPercent: number;
  timestamp: string;
}

interface SentimentBarCardProps {
  symbol: string;
  blendedLong: number;
  blendedShort: number;
  sources: SourceData[];
  sourcesUsed: string[];
  onClick?: () => void;
}

export default function SentimentBarCard({
  symbol,
  blendedLong,
  blendedShort,
  sources,
  sourcesUsed,
  onClick,
}: SentimentBarCardProps) {
  const contrarian = computeContrarian(blendedLong, blendedShort);

  // Get label color
  const getLabelColor = (label: ContrarianLabel) => {
    switch (label) {
      case 'BULLISH':
        return 'text-sentiment-bullish';
      case 'BEARISH':
        return 'text-sentiment-bearish';
      case 'NEUTRAL':
        return 'text-gray-400';
    }
  };

  const labelColor = getLabelColor(contrarian.label);
  const allSources = getAllSources();

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-background-secondary rounded-lg p-4 hover:bg-surface-hover transition-colors border border-transparent hover:border-border-primary"
    >
      {/* Header: Symbol */}
      <div className="text-center mb-3">
        <h3 className="text-lg font-semibold text-text-primary">{symbol}</h3>
      </div>

      {/* Middle: Contrarian Label */}
      <div className="flex items-center justify-center mb-3">
        <span className={`text-sm font-semibold tracking-wide ${labelColor}`}>
          {contrarian.label === 'NEUTRAL' ? 'MIXED' : contrarian.label}
        </span>
      </div>

      {/* Bar with percentages */}
      <div className="relative">
        {/* Percentage labels */}
        <div className="flex justify-between mb-1">
          <span className="text-sm font-mono text-sentiment-bullish">{blendedLong.toFixed(0)}%</span>
          <span className="text-sm font-mono text-sentiment-bearish">{blendedShort.toFixed(0)}%</span>
        </div>

        {/* Bar */}
        <div className="h-3 flex rounded overflow-hidden relative">
          {/* Long side (left, green) */}
          <div
            className="bg-sentiment-bullish transition-all duration-300"
            style={{ width: `${blendedLong}%` }}
          />
          {/* Short side (right, red) */}
          <div
            className="bg-sentiment-bearish transition-all duration-300"
            style={{ width: `${blendedShort}%` }}
          />
          {/* Center dotted line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px border-l border-dashed border-white/70" />
        </div>
      </div>

      {/* Source badges */}
      <div className="flex justify-center gap-1 mt-3">
        {allSources.map((source) => {
          const isUsed = sourcesUsed.includes(source);
          const badge = getSourceBadge(source);
          return (
            <span
              key={source}
              className={`w-5 h-5 flex items-center justify-center rounded text-xs font-medium ${
                isUsed
                  ? 'bg-surface-secondary text-text-primary'
                  : 'bg-surface-secondary/30 text-text-muted/40'
              }`}
              title={`${source}${isUsed ? '' : ' (no data)'}`}
            >
              {badge}
            </span>
          );
        })}
      </div>
    </button>
  );
}
