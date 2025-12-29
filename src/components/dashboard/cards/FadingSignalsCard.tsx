'use client';

import { useRouter } from 'next/navigation';
import type { SignalChange } from '@/types';

interface FadingSignalsCardProps {
  signals: SignalChange[];
}

export default function FadingSignalsCard({ signals }: FadingSignalsCardProps) {
  const router = useRouter();
  if (signals.length === 0) {
    return (
      <div className="bg-background-secondary rounded-lg p-4 h-full">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-gray-400/50" />
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            Fading Signals
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center h-32 text-text-muted">
          <div className="text-2xl mb-2 opacity-30">✓</div>
          <p className="text-xs text-center">All signals holding strong</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-secondary rounded-lg p-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-400/70" />
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            Fading Signals
          </h3>
        </div>
        <span className="text-[10px] font-mono text-orange-400/80 bg-orange-400/10 px-1.5 py-0.5 rounded">
          {signals.length} WEAK
        </span>
      </div>

      {/* Signals list */}
      <div className="space-y-2">
        {signals.map((signal, index) => {
          const strengthDrop = signal.previousStrength - signal.currentStrength;
          const wasNeutralized = signal.currentLabel === 'NEUTRAL';

          return (
            <button
              key={signal.symbol}
              onClick={() => router.push(`/sentiment/history?symbol=${encodeURIComponent(signal.symbol)}`)}
              className="w-full flex items-center justify-between p-2 rounded-md bg-surface-secondary/30 hover:bg-surface-secondary/50 transition-all duration-200 group"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center gap-2">
                {/* Fade indicator */}
                <div className="w-5 h-5 rounded flex items-center justify-center text-xs bg-orange-400/20 text-orange-400">
                  ↘
                </div>

                {/* Symbol */}
                <span className="text-sm font-mono font-medium text-text-primary group-hover:text-white transition-colors">
                  {signal.symbol}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Strength change */}
                <div className="flex items-center gap-1 text-xs font-mono">
                  <span className="text-text-muted">{signal.previousStrength.toFixed(2)}pp</span>
                  <span className="text-text-muted/50">→</span>
                  <span className={wasNeutralized ? 'text-gray-400' : 'text-orange-400'}>
                    {signal.currentStrength.toFixed(2)}pp
                  </span>
                </div>

                {/* Drop badge */}
                {wasNeutralized ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-500/30 text-gray-400">
                    MIXED
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-400/20 text-orange-400">
                    -{strengthDrop.toFixed(2)}pp
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer hint */}
      <p className="text-[10px] text-text-muted/50 text-center mt-3">
        Signals losing momentum
      </p>
    </div>
  );
}
