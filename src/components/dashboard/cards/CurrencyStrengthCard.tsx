'use client';

import type { CurrencyStrength } from '@/types';

interface CurrencyStrengthCardProps {
  data: CurrencyStrength[];
}

// Currency flag emojis for visual interest
const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  JPY: '🇯🇵',
  AUD: '🇦🇺',
  NZD: '🇳🇿',
  CAD: '🇨🇦',
  CHF: '🇨🇭',
};

export default function CurrencyStrengthCard({ data }: CurrencyStrengthCardProps) {
  // Find max absolute strength for scaling
  const maxStrength = Math.max(...data.map((d) => Math.abs(d.strength)), 1);

  return (
    <div className="bg-background-secondary rounded-lg p-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-4 bg-gradient-to-b from-sentiment-bullish to-sentiment-bearish rounded-full" />
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
          Currency Strength
        </h3>
      </div>

      {/* Bars */}
      <div className="space-y-2">
        {data.map((item, index) => {
          const barWidth = Math.abs(item.strength) / maxStrength * 50;
          const isPositive = item.strength >= 0;

          return (
            <div
              key={item.currency}
              className="group flex items-center gap-2 transition-all duration-200"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Currency label with flag */}
              <div className="flex items-center gap-1.5 w-16 shrink-0">
                <span className="text-xs opacity-70">{CURRENCY_FLAGS[item.currency]}</span>
                <span className="text-xs font-mono font-medium text-text-primary">
                  {item.currency}
                </span>
              </div>

              {/* Bar container - centered at 0 */}
              <div className="flex-1 h-5 relative">
                {/* Background track */}
                <div className="absolute inset-0 bg-surface-secondary/30 rounded-sm" />

                {/* Center line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border-primary/50" />

                {/* Strength bar */}
                <div
                  className={`absolute top-0.5 bottom-0.5 rounded-sm transition-all duration-500 ease-out ${
                    isPositive
                      ? 'left-1/2 bg-gradient-to-r from-sentiment-bullish/80 to-sentiment-bullish'
                      : 'right-1/2 bg-gradient-to-l from-sentiment-bearish/80 to-sentiment-bearish'
                  }`}
                  style={{
                    width: `${barWidth}%`,
                    boxShadow: isPositive
                      ? '0 0 8px rgba(34, 197, 94, 0.3)'
                      : '0 0 8px rgba(239, 68, 68, 0.3)',
                  }}
                />
              </div>

              {/* Value */}
              <div className={`w-12 text-right shrink-0 text-xs font-mono font-semibold ${
                isPositive ? 'text-sentiment-bullish' : 'text-sentiment-bearish'
              }`}>
                {isPositive ? '+' : ''}{item.strength.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scale indicators */}
      <div className="flex justify-between mt-3 text-[10px] font-mono text-text-muted/50">
        <span>WEAK</span>
        <span>STRONG</span>
      </div>
    </div>
  );
}
