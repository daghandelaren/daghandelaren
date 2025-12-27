'use client';

import { useMemo, useState } from 'react';
import { CURRENCIES } from '@/lib/constants';
import { computeContrarian, getContrarianLabelColor } from '@/lib/sentiment/contrarian';

interface SentimentItem {
  symbol: string;
  base: string;
  quote: string;
  netSentiment: number;
  longPercent: number;
  shortPercent: number;
  blendedLong: number;
  blendedShort: number;
  blendedNet: number;
}

interface SentimentMatrixProps {
  data: SentimentItem[];
  loading?: boolean;
}

interface CellData {
  symbol: string;
  blendedNet: number;
  blendedLong: number;
  blendedShort: number;
}

// Get background color based on contrarian label
function getMatrixCellBg(blendedLong: number, blendedShort: number): string {
  const contrarian = computeContrarian(blendedLong, blendedShort);

  switch (contrarian.label) {
    case 'BULLISH':
      return 'bg-sentiment-bullish/40';
    case 'BEARISH':
      return 'bg-sentiment-bearish/40';
    case 'NEUTRAL':
      return 'bg-gray-600/30';
  }
}

export default function SentimentMatrix({ data, loading }: SentimentMatrixProps) {
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null);

  // Build matrix data using blended values
  const matrix = useMemo(() => {
    const matrixData: Record<string, Record<string, CellData | null>> = {};

    // Initialize matrix with null values
    for (const base of CURRENCIES) {
      matrixData[base] = {};
      for (const quote of CURRENCIES) {
        matrixData[base][quote] = null;
      }
    }

    // Fill in data with blended values
    for (const item of data) {
      // Only include forex pairs
      if (!CURRENCIES.includes(item.base as (typeof CURRENCIES)[number])) continue;
      if (!CURRENCIES.includes(item.quote as (typeof CURRENCIES)[number])) continue;

      matrixData[item.base][item.quote] = {
        symbol: item.symbol,
        blendedNet: item.blendedNet,
        blendedLong: item.blendedLong,
        blendedShort: item.blendedShort,
      };
    }

    return matrixData;
  }, [data]);

  if (loading) {
    return (
      <div className="card p-4 overflow-x-auto">
        <div className="animate-pulse">
          <div className="grid grid-cols-9 gap-1">
            {[...Array(81)].map((_, i) => (
              <div key={i} className="aspect-square bg-surface-secondary rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header row with quote currencies */}
        <div className="grid grid-cols-9 gap-1 mb-1">
          <div className="aspect-square flex items-center justify-center">
            <span className="text-xs text-text-muted">Base/Quote</span>
          </div>
          {CURRENCIES.map((quote) => (
            <div
              key={quote}
              className="aspect-square flex items-center justify-center bg-surface-secondary rounded"
            >
              <span className="text-sm font-medium text-text-primary">{quote}</span>
            </div>
          ))}
        </div>

        {/* Matrix rows */}
        {CURRENCIES.map((base) => (
          <div key={base} className="grid grid-cols-9 gap-1 mb-1">
            {/* Base currency label */}
            <div className="aspect-square flex items-center justify-center bg-surface-secondary rounded">
              <span className="text-sm font-medium text-text-primary">{base}</span>
            </div>

            {/* Cells */}
            {CURRENCIES.map((quote) => {
              const cell = matrix[base]?.[quote];
              const isBase = base === quote;

              if (isBase) {
                return (
                  <div
                    key={`${base}-${quote}`}
                    className="aspect-square flex items-center justify-center bg-surface-tertiary rounded opacity-30"
                  >
                    <span className="text-xs text-text-muted">-</span>
                  </div>
                );
              }

              if (!cell) {
                return (
                  <div
                    key={`${base}-${quote}`}
                    className="aspect-square flex items-center justify-center bg-surface-secondary rounded opacity-50"
                  >
                    <span className="text-xs text-text-muted">N/A</span>
                  </div>
                );
              }

              const bgColor = getMatrixCellBg(cell.blendedLong, cell.blendedShort);
              const contrarian = computeContrarian(cell.blendedLong, cell.blendedShort);

              return (
                <button
                  key={`${base}-${quote}`}
                  className={`aspect-square flex flex-col items-center justify-center rounded cursor-pointer transition-all hover:ring-2 hover:ring-accent-blue ${bgColor}`}
                  onClick={() => setSelectedCell(cell)}
                  title={`${cell.symbol}: ${contrarian.label === 'NEUTRAL' ? 'MIXED' : contrarian.label}`}
                >
                  <span className="text-xs font-mono text-text-primary">
                    {cell.blendedNet >= 0 ? '+' : ''}
                    {cell.blendedNet.toFixed(0)}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-sentiment-bearish/40" />
          <span className="text-text-secondary">Bearish (Short Bias)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-600/30" />
          <span className="text-text-secondary">Mixed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-sentiment-bullish/40" />
          <span className="text-text-secondary">Bullish (Long Bias)</span>
        </div>
      </div>

      {/* Selected cell details */}
      {selectedCell && (
        <div className="mt-4 p-4 bg-surface-secondary rounded-lg">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-text-primary">{selectedCell.symbol}</h4>
            <button
              onClick={() => setSelectedCell(null)}
              className="text-text-muted hover:text-text-primary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-2">
            <div>
              <p className="text-xs text-text-muted">Long</p>
              <p className="text-sentiment-bullish font-mono">{selectedCell.blendedLong.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Short</p>
              <p className="text-sentiment-bearish font-mono">{selectedCell.blendedShort.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Net</p>
              <p
                className={`font-mono font-medium ${
                  selectedCell.blendedNet > 0
                    ? 'text-sentiment-bullish'
                    : selectedCell.blendedNet < 0
                      ? 'text-sentiment-bearish'
                      : 'text-gray-400'
                }`}
              >
                {selectedCell.blendedNet >= 0 ? '+' : ''}
                {selectedCell.blendedNet.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Signal</p>
              {(() => {
                const contrarian = computeContrarian(selectedCell.blendedLong, selectedCell.blendedShort);
                return (
                  <p className={`font-medium ${getContrarianLabelColor(contrarian.label)}`}>
                    {contrarian.label === 'NEUTRAL' ? 'MIXED' : contrarian.label}
                  </p>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
