'use client';

import type { SignalChange } from '@/types';

interface NewSignalsCardProps {
  signals: SignalChange[];
  onSymbolClick?: (symbol: string) => void;
}

export default function NewSignalsCard({ signals, onSymbolClick }: NewSignalsCardProps) {
  if (signals.length === 0) {
    return (
      <div className="bg-background-secondary rounded-lg p-4 h-full">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            New Signals
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center h-32 text-text-muted">
          <div className="text-2xl mb-2 opacity-30">📡</div>
          <p className="text-xs text-center">No new signals in the last 48 hours</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-secondary rounded-lg p-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            New Signals
          </h3>
        </div>
        <span className="text-[10px] font-mono text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded">
          {signals.length} NEW
        </span>
      </div>

      {/* Signals list */}
      <div className="space-y-2">
        {signals.map((signal, index) => {
          const isBullish = signal.currentLabel === 'BULLISH';

          return (
            <button
              key={signal.symbol}
              onClick={() => onSymbolClick?.(signal.symbol)}
              className="w-full flex items-center justify-between p-2 rounded-md bg-surface-secondary/30 hover:bg-surface-secondary/50 transition-all duration-200 group"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center gap-2">
                {/* Arrow indicator */}
                <div className={`w-5 h-5 rounded flex items-center justify-center text-xs ${
                  isBullish
                    ? 'bg-sentiment-bullish/20 text-sentiment-bullish'
                    : 'bg-sentiment-bearish/20 text-sentiment-bearish'
                }`}>
                  {isBullish ? '↑' : '↓'}
                </div>

                {/* Symbol */}
                <span className="text-sm font-mono font-medium text-text-primary group-hover:text-white transition-colors">
                  {signal.symbol}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Strength badge */}
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                  isBullish
                    ? 'bg-sentiment-bullish/20 text-sentiment-bullish'
                    : 'bg-sentiment-bearish/20 text-sentiment-bearish'
                }`}>
                  {signal.currentStrength.toFixed(2)}pp
                </span>

                {/* Label badge */}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isBullish
                    ? 'bg-sentiment-bullish text-black'
                    : 'bg-sentiment-bearish text-white'
                }`}>
                  {signal.currentLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer hint */}
      <p className="text-[10px] text-text-muted/50 text-center mt-3">
        Crossed 60/40 in last 48h
      </p>
    </div>
  );
}
