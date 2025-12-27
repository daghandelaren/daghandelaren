'use client';

import type { NewOverviewData } from '@/types';
import CurrencyStrengthCard from './cards/CurrencyStrengthCard';
import RiskSentimentCard from './cards/RiskSentimentCard';
import NewSignalsCard from './cards/NewSignalsCard';
import FadingSignalsCard from './cards/FadingSignalsCard';

interface OverviewCardsProps {
  data: NewOverviewData | null;
  loading?: boolean;
  onSymbolClick?: (symbol: string) => void;
}

export default function OverviewCards({ data, loading, onSymbolClick }: OverviewCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-background-secondary rounded-lg p-4 animate-pulse">
            <div className="h-4 w-24 bg-surface-secondary rounded mb-3" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-surface-secondary rounded" />
              <div className="h-3 w-3/4 bg-surface-secondary rounded" />
              <div className="h-3 w-5/6 bg-surface-secondary rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <CurrencyStrengthCard data={data.currencyStrength} />
      <RiskSentimentCard data={data.riskSentiment} />
      <NewSignalsCard signals={data.newSignals} onSymbolClick={onSymbolClick} />
      <FadingSignalsCard signals={data.fadingSignals} onSymbolClick={onSymbolClick} />
    </div>
  );
}
