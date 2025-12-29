'use client';

import { useState, useMemo } from 'react';

interface PairBias {
  pair: string;
  base: string;
  quote: string;
  score: number;
  rating: 'Bullish' | 'Neutral' | 'Bearish';
}

interface PairBiasTableProps {
  pairs: PairBias[];
}

type SortKey = 'pair' | 'score' | 'rating';
type SortOrder = 'asc' | 'desc';
type FilterType = 'all' | 'Bullish' | 'Bearish';

export default function PairBiasTable({ pairs }: PairBiasTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filter, setFilter] = useState<FilterType>('all');

  const counts = useMemo(() => ({
    all: pairs.length,
    Bullish: pairs.filter(p => p.rating === 'Bullish').length,
    Bearish: pairs.filter(p => p.rating === 'Bearish').length,
    Neutral: pairs.filter(p => p.rating === 'Neutral').length,
  }), [pairs]);

  const maxAbsScore = useMemo(() =>
    Math.max(...pairs.map(p => Math.abs(p.score)), 1)
  , [pairs]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const sortedPairs = useMemo(() => [...pairs]
    .filter((p) => filter === 'all' || p.rating === filter)
    .sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'pair') {
        comparison = a.pair.localeCompare(b.pair);
      } else if (sortKey === 'score') {
        comparison = a.score - b.score;
      } else if (sortKey === 'rating') {
        const order = { Bullish: 2, Neutral: 1, Bearish: 0 };
        comparison = order[a.rating] - order[b.rating];
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    }), [pairs, filter, sortKey, sortOrder]);

  const getScoreBarWidth = (score: number) => {
    return `${(Math.abs(score) / maxAbsScore) * 100}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <FilterPill
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            count={counts.all}
          >
            All Pairs
          </FilterPill>
          <FilterPill
            active={filter === 'Bullish'}
            onClick={() => setFilter('Bullish')}
            count={counts.Bullish}
            variant="bullish"
          >
            Bullish
          </FilterPill>
          <FilterPill
            active={filter === 'Bearish'}
            onClick={() => setFilter('Bearish')}
            count={counts.Bearish}
            variant="bearish"
          >
            Bearish
          </FilterPill>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-1 text-sm">
          <span className="text-text-muted mr-2">Sort:</span>
          {(['pair', 'score', 'rating'] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={`px-3 py-1.5 rounded-lg transition-all duration-200 capitalize ${
                sortKey === key
                  ? 'bg-accent-blue/20 text-accent-blue font-medium'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-secondary'
              }`}
            >
              {key === 'rating' ? 'Bias' : key}
              {sortKey === key && (
                <span className="ml-1">{sortOrder === 'desc' ? '↓' : '↑'}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Pairs Grid */}
      {sortedPairs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sortedPairs.map((pair, index) => (
            <PairCard
              key={pair.pair}
              pair={pair}
              maxAbsScore={maxAbsScore}
              index={index}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-lg">No pairs match the current filter</p>
        </div>
      )}

      {/* Summary Stats */}
      {sortedPairs.length > 0 && (
        <div className="flex items-center justify-center gap-6 pt-4 border-t border-border-primary/30 text-sm text-text-muted">
          <span>
            Showing <span className="text-text-primary font-medium">{sortedPairs.length}</span> pairs
          </span>
          <span className="text-border-primary">•</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sentiment-bullish"></span>
            {counts.Bullish} bullish
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sentiment-bearish"></span>
            {counts.Bearish} bearish
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-500"></span>
            {counts.Neutral} neutral
          </span>
        </div>
      )}
    </div>
  );
}

// Filter Pill Component
function FilterPill({
  children,
  active,
  onClick,
  count,
  variant = 'default'
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count: number;
  variant?: 'default' | 'bullish' | 'bearish';
}) {
  const getVariantStyles = () => {
    if (!active) return 'bg-surface-secondary/50 text-text-muted hover:bg-surface-secondary hover:text-text-primary';

    switch (variant) {
      case 'bullish':
        return 'bg-sentiment-bullish/20 text-sentiment-bullish border-sentiment-bullish/30';
      case 'bearish':
        return 'bg-sentiment-bearish/20 text-sentiment-bearish border-sentiment-bearish/30';
      default:
        return 'bg-accent-blue/20 text-accent-blue border-accent-blue/30';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200
        ${active ? 'border-current' : 'border-transparent'}
        ${getVariantStyles()}
      `}
    >
      <span className="font-medium">{children}</span>
      <span className={`
        text-xs px-1.5 py-0.5 rounded-full
        ${active ? 'bg-current/20' : 'bg-surface-primary/50'}
      `}>
        {count}
      </span>
    </button>
  );
}

// Pair Card Component
function PairCard({
  pair,
  maxAbsScore,
  index
}: {
  pair: PairBias;
  maxAbsScore: number;
  index: number;
}) {
  const scorePercent = (Math.abs(pair.score) / maxAbsScore) * 100;
  const isBullish = pair.rating === 'Bullish';
  const isBearish = pair.rating === 'Bearish';
  const isNeutral = pair.rating === 'Neutral';

  const getCardStyle = () => {
    if (isBullish) return 'border-sentiment-bullish/30 hover:border-sentiment-bullish/50';
    if (isBearish) return 'border-sentiment-bearish/30 hover:border-sentiment-bearish/50';
    return 'border-border-primary/50 hover:border-border-primary';
  };

  const getGlowStyle = () => {
    if (isBullish) return 'shadow-[0_0_30px_-10px_rgba(34,197,94,0.3)]';
    if (isBearish) return 'shadow-[0_0_30px_-10px_rgba(239,68,68,0.3)]';
    return '';
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border bg-surface-primary/50 backdrop-blur-sm
        transition-all duration-300 ease-out hover:scale-[1.02]
        ${getCardStyle()}
        ${getGlowStyle()}
      `}
      style={{
        animationDelay: `${index * 30}ms`,
      }}
    >
      {/* Background gradient based on bias */}
      <div className={`
        absolute inset-0 opacity-[0.04] pointer-events-none
        ${isBullish ? 'bg-gradient-to-br from-sentiment-bullish via-transparent to-transparent' : ''}
        ${isBearish ? 'bg-gradient-to-br from-sentiment-bearish via-transparent to-transparent' : ''}
      `} />

      <div className="relative p-4">
        {/* Header: Pair Name and Rating Badge */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-text-primary tracking-tight font-mono">
                {pair.base}
              </span>
              <span className="text-text-muted">/</span>
              <span className="text-lg font-bold text-text-primary tracking-tight font-mono">
                {pair.quote}
              </span>
            </div>
          </div>

          <div className={`
            px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider
            ${isBullish ? 'bg-sentiment-bullish/15 text-sentiment-bullish' : ''}
            ${isBearish ? 'bg-sentiment-bearish/15 text-sentiment-bearish' : ''}
            ${isNeutral ? 'bg-gray-500/15 text-gray-400' : ''}
          `}>
            {pair.rating}
          </div>
        </div>

        {/* Score Display */}
        <div className="flex items-center gap-3 mb-3">
          <span className={`
            text-3xl font-mono font-bold tracking-tighter
            ${isBullish ? 'text-sentiment-bullish' : ''}
            ${isBearish ? 'text-sentiment-bearish' : ''}
            ${isNeutral ? 'text-gray-400' : ''}
          `}>
            {pair.score > 0 ? '+' : ''}{pair.score}
          </span>
          <span className="text-xs text-text-muted uppercase tracking-wider">Score</span>
        </div>

        {/* Score Bar Visualization */}
        <div className="relative h-2 bg-surface-secondary/50 rounded-full overflow-hidden">
          <div
            className={`
              absolute top-0 h-full rounded-full transition-all duration-500 ease-out
              ${isBullish ? 'left-1/2 bg-gradient-to-r from-sentiment-bullish/50 to-sentiment-bullish' : ''}
              ${isBearish ? 'right-1/2 bg-gradient-to-l from-sentiment-bearish/50 to-sentiment-bearish' : ''}
              ${isNeutral ? 'left-1/2 -translate-x-1/2 bg-gray-500' : ''}
            `}
            style={{
              width: isNeutral ? '4px' : `${scorePercent / 2}%`,
            }}
          />
          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-text-muted/30 -translate-x-1/2" />
        </div>

        {/* Direction indicator */}
        <div className="flex items-center justify-between mt-3 text-xs">
          <span className={`flex items-center gap-1 ${isBearish ? 'text-sentiment-bearish' : 'text-text-muted'}`}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Sell {pair.base}
          </span>
          <span className={`flex items-center gap-1 ${isBullish ? 'text-sentiment-bullish' : 'text-text-muted'}`}>
            Buy {pair.base}
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
