'use client';

import { useState, useMemo } from 'react';
import SentimentBarCard from './SentimentBarCard';
import { computeContrarian } from '@/lib/sentiment/contrarian';
import { getSourceWeight, getAllSources, getSourceBadge } from '@/lib/sentiment/blend';
import { formatTimeAgo } from '@/lib/utils';

interface SourceData {
  name: string;
  longPercent: number;
  shortPercent: number;
  netSentiment: number;
  timestamp: string;
}

interface SentimentItem {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  assetClass: string;
  blendedLong: number;
  blendedShort: number;
  sourcesUsed: string[];
  sources: SourceData[];
  lastUpdated: string;
}

interface SentimentOverviewProps {
  data: SentimentItem[];
  loading?: boolean;
}

export default function SentimentOverview({ data, loading }: SentimentOverviewProps) {
  const [selectedItem, setSelectedItem] = useState<SentimentItem | null>(null);

  // Sort data: valid signals (strength >= 20) first sorted by strength desc, then NEUTRAL
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const contrarianA = computeContrarian(a.blendedLong, a.blendedShort);
      const contrarianB = computeContrarian(b.blendedLong, b.blendedShort);

      // Signals first (non-neutral)
      const aIsSignal = contrarianA.label !== 'NEUTRAL';
      const bIsSignal = contrarianB.label !== 'NEUTRAL';

      if (aIsSignal && !bIsSignal) return -1;
      if (!aIsSignal && bIsSignal) return 1;

      // Both signals or both neutral: sort by strength desc
      return contrarianB.strength - contrarianA.strength;
    });
  }, [data]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="bg-background-secondary rounded-lg p-4 animate-pulse">
            <div className="h-6 w-24 bg-surface-secondary rounded mx-auto mb-3" />
            <div className="h-4 w-16 bg-surface-secondary rounded mx-auto mb-3" />
            <div className="h-3 bg-surface-secondary rounded mb-2" />
            <div className="flex justify-center gap-1 mt-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="w-5 h-5 bg-surface-secondary rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-background-secondary rounded-lg p-8 text-center">
        <p className="text-text-secondary">No sentiment data available</p>
        <p className="text-text-muted text-sm mt-1">
          Data will appear once scrapers have collected information
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Grid of bar cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedData.map((item) => (
          <SentimentBarCard
            key={item.id}
            symbol={item.symbol}
            blendedLong={item.blendedLong}
            blendedShort={item.blendedShort}
            sources={item.sources}
            sourcesUsed={item.sourcesUsed}
            onClick={() => setSelectedItem(item)}
          />
        ))}
      </div>

      {/* Detail Modal/Drawer */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-background-secondary rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-text-primary">{selectedItem.symbol}</h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Blended Result */}
            <div className="bg-surface-primary rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-text-muted uppercase tracking-wide mb-3">
                Blended Sentiment
              </h4>
              <div className="flex justify-between mb-2">
                <div>
                  <span className="text-xs text-text-muted">Long %</span>
                  <p className="text-2xl font-mono text-sentiment-bullish">
                    {selectedItem.blendedLong.toFixed(1)}%
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-text-muted">Short %</span>
                  <p className="text-2xl font-mono text-sentiment-bearish">
                    {selectedItem.blendedShort.toFixed(1)}%
                  </p>
                </div>
              </div>
              {/* Bar */}
              <div className="h-4 flex rounded overflow-hidden relative">
                <div
                  className="bg-sentiment-bullish"
                  style={{ width: `${selectedItem.blendedLong}%` }}
                />
                <div
                  className="bg-sentiment-bearish"
                  style={{ width: `${selectedItem.blendedShort}%` }}
                />
                <div className="absolute left-1/2 top-0 bottom-0 w-px border-l border-dashed border-white/70" />
              </div>
              {/* Contrarian Signal */}
              {(() => {
                const contrarian = computeContrarian(selectedItem.blendedLong, selectedItem.blendedShort);
                return (
                  <div className="mt-3 text-center">
                    <span
                      className={`text-sm font-medium ${
                        contrarian.label === 'BULLISH'
                          ? 'text-sentiment-bullish'
                          : contrarian.label === 'BEARISH'
                            ? 'text-sentiment-bearish'
                            : 'text-gray-400'
                      }`}
                    >
                      Contrarian Signal: {contrarian.label === 'NEUTRAL' ? 'MIXED' : contrarian.label}
                    </span>
                    <span className="text-text-muted text-xs ml-2">
                      (Strength: {contrarian.strength.toFixed(0)}pp)
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Weights Info */}
            <div className="bg-surface-primary rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-text-muted uppercase tracking-wide mb-3">
                Source Weights
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                {getAllSources().map((source) => {
                  const isUsed = selectedItem.sourcesUsed.includes(source);
                  return (
                    <div key={source}>
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded text-sm font-medium ${
                          isUsed
                            ? 'bg-accent-blue text-white'
                            : 'bg-surface-secondary text-text-muted'
                        }`}
                      >
                        {getSourceBadge(source)}
                      </span>
                      <p className="text-xs text-text-muted mt-1">
                        Weight: {getSourceWeight(source)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Per-Source Breakdown */}
            <div className="bg-surface-primary rounded-lg p-4">
              <h4 className="text-sm font-medium text-text-muted uppercase tracking-wide mb-3">
                Per-Source Data
              </h4>
              <div className="space-y-3">
                {getAllSources().map((sourceName) => {
                  const sourceData = selectedItem.sources.find(
                    (s) => s.name.toLowerCase() === sourceName
                  );
                  const weight = getSourceWeight(sourceName);

                  return (
                    <div
                      key={sourceName}
                      className={`p-3 rounded-lg ${
                        sourceData ? 'bg-surface-secondary' : 'bg-surface-secondary/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 flex items-center justify-center rounded text-xs font-medium ${
                              sourceData
                                ? 'bg-accent-blue text-white'
                                : 'bg-surface-primary text-text-muted'
                            }`}
                          >
                            {getSourceBadge(sourceName)}
                          </span>
                          <span className="text-sm font-medium text-text-primary capitalize">
                            {sourceName}
                          </span>
                          <span className="text-xs text-text-muted">(w={weight})</span>
                        </div>
                        {sourceData && (
                          <span className="text-xs text-text-muted">
                            {formatTimeAgo(new Date(sourceData.timestamp))}
                          </span>
                        )}
                      </div>
                      {sourceData ? (
                        <div className="flex justify-between text-sm">
                          <span className="text-sentiment-bullish font-mono">
                            Long: {sourceData.longPercent.toFixed(1)}%
                          </span>
                          <span className="text-sentiment-bearish font-mono">
                            Short: {sourceData.shortPercent.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-text-muted">No data available</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setSelectedItem(null)}
              className="w-full mt-6 py-2 bg-surface-secondary hover:bg-surface-hover text-text-primary rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
