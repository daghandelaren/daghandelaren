'use client';

interface CurrencyScoreCardProps {
  currency: string;
  totalScore: number;
  rating: string;
  inflationTrend: string;
  pmiSignal: string;
  centralBankTone: string;
  rateDifferential: string;
  commodityTailwind: string;
  cpiActual?: number | null;
  cpiPrevious?: number | null;
  pmiActual?: number | null;
  pmiPrevious?: number | null;
  aiJustification?: string | null;
  manualOverride?: boolean;
  onClick?: () => void;
}

// Check if currency has commodity exposure
const COMMODITY_CURRENCIES = ['AUD', 'CAD', 'NZD'];

export default function CurrencyScoreCard({
  currency,
  totalScore,
  rating,
  inflationTrend,
  pmiSignal,
  centralBankTone,
  rateDifferential,
  commodityTailwind,
  cpiActual,
  cpiPrevious,
  pmiActual,
  pmiPrevious,
  aiJustification,
  manualOverride,
  onClick,
}: CurrencyScoreCardProps) {
  const hasCommodityExposure = COMMODITY_CURRENCIES.includes(currency);

  const getRatingGlow = (rating: string) => {
    switch (rating) {
      case 'Bullish':
        return 'shadow-[0_0_25px_-5px_rgba(34,197,94,0.35)]';
      case 'Bearish':
        return 'shadow-[0_0_25px_-5px_rgba(239,68,68,0.35)]';
      default:
        return '';
    }
  };

  const getRatingBorder = (rating: string) => {
    switch (rating) {
      case 'Bullish':
        return 'border-sentiment-bullish/40 hover:border-sentiment-bullish/60';
      case 'Bearish':
        return 'border-sentiment-bearish/40 hover:border-sentiment-bearish/60';
      default:
        return 'border-border-primary/50 hover:border-border-primary';
    }
  };

  const getRatingBadgeStyle = (rating: string) => {
    switch (rating) {
      case 'Bullish':
        return 'bg-sentiment-bullish/15 text-sentiment-bullish border border-sentiment-bullish/30';
      case 'Bearish':
        return 'bg-sentiment-bearish/15 text-sentiment-bearish border border-sentiment-bearish/30';
      default:
        return 'bg-gray-500/15 text-gray-400 border border-gray-500/30';
    }
  };

  const getScoreColor = (score: number) => {
    if (score > 0) return 'text-sentiment-bullish';
    if (score < 0) return 'text-sentiment-bearish';
    return 'text-gray-400';
  };

  // BULLISH signals: Up, Hawkish, Yes = GREEN
  // BEARISH signals: Down, Dovish, No = RED
  const getTrendColor = (value: string) => {
    if (['Up', 'Hawkish', 'Yes', 'Positive', 'Rising'].includes(value)) {
      return 'text-green-400';
    }
    if (['Down', 'Dovish', 'No', 'Negative', 'Falling'].includes(value)) {
      return 'text-red-400';
    }
    return 'text-gray-400';
  };

  const getTrendBg = (value: string) => {
    if (['Up', 'Hawkish', 'Yes', 'Positive', 'Rising'].includes(value)) {
      return 'bg-green-500/10 border-green-500/20';
    }
    if (['Down', 'Dovish', 'No', 'Negative', 'Falling'].includes(value)) {
      return 'bg-red-500/10 border-red-500/20';
    }
    return 'bg-gray-500/10 border-gray-500/20';
  };

  const getTrendIcon = (value: string) => {
    if (['Up', 'Hawkish', 'Yes', 'Positive', 'Rising'].includes(value)) {
      return '▲';
    }
    if (['Down', 'Dovish', 'No', 'Negative', 'Falling'].includes(value)) {
      return '▼';
    }
    return '●';
  };

  const formatNumber = (val: number | null | undefined) => {
    if (val === null || val === undefined) return null;
    return val.toFixed(1);
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-xl border bg-surface-primary/50 backdrop-blur-sm
        transition-all duration-300 ease-out
        ${getRatingBorder(rating)}
        ${getRatingGlow(rating)}
        ${onClick ? 'cursor-pointer hover:scale-[1.02] hover:bg-surface-primary/80' : ''}
      `}
    >
      {/* Subtle gradient overlay based on rating */}
      <div className={`absolute inset-0 opacity-[0.03] pointer-events-none ${
        rating === 'Bullish' ? 'bg-gradient-to-br from-sentiment-bullish to-transparent' :
        rating === 'Bearish' ? 'bg-gradient-to-br from-sentiment-bearish to-transparent' :
        ''
      }`} />

      <div className="relative p-5">
        {/* Header: Currency + Score */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-bold text-text-primary tracking-tight">
                {currency}
              </span>
              {manualOverride && (
                <span className="text-[10px] px-1.5 py-0.5 bg-accent-blue/20 text-accent-blue rounded font-medium uppercase tracking-wider">
                  Manual
                </span>
              )}
            </div>
            <div className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${getRatingBadgeStyle(rating)}`}>
              {rating}
            </div>
          </div>

          <div className="flex flex-col items-end">
            <div className={`text-3xl font-mono font-bold tracking-tighter ${getScoreColor(totalScore)}`}>
              {totalScore > 0 ? '+' : ''}{totalScore}
            </div>
            <span className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Score</span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            HERO SECTION: 2Y Yield Differential - The Primary Signal
        ═══════════════════════════════════════════════════════════════════ */}
        <div className={`relative rounded-lg p-4 mb-4 border ${getTrendBg(rateDifferential)}`}>
          {/* Decorative corner accent */}
          <div className={`absolute top-0 right-0 w-16 h-16 opacity-20 ${
            rateDifferential === 'Up' ? 'bg-gradient-to-bl from-green-500' :
            rateDifferential === 'Down' ? 'bg-gradient-to-bl from-red-500' :
            'bg-gradient-to-bl from-gray-500'
          } rounded-bl-full`} />

          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
                2Y Yield Spread
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-3">
                <span className={`text-2xl font-bold tracking-tight ${getTrendColor(rateDifferential)}`}>
                  {rateDifferential}
                </span>
                <span className={`text-lg ${getTrendColor(rateDifferential)}`}>
                  {getTrendIcon(rateDifferential)}
                </span>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-text-muted uppercase tracking-wider">vs USD</div>
                <div className="text-xs text-text-secondary">MA20 × MA60</div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SECONDARY ROW: Central Bank + Commodity (if applicable)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className={`grid ${hasCommodityExposure ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mb-3`}>
          {/* Central Bank Tone */}
          <div className="bg-surface-secondary/40 rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                Central Bank
              </span>
            </div>
            <div className={`text-base font-semibold ${getTrendColor(centralBankTone)}`}>
              {centralBankTone}
            </div>
          </div>

          {/* Commodity Tailwind - only for AUD, CAD, NZD */}
          {hasCommodityExposure && (
            <div className="bg-surface-secondary/40 rounded-lg p-3">
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                  Commodity
                </span>
              </div>
              <div className={`text-base font-semibold ${getTrendColor(commodityTailwind)}`}>
                {commodityTailwind === 'Yes' ? 'Tailwind' : commodityTailwind === 'No' ? 'Headwind' : 'Neutral'}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TERTIARY ROW: CPI + PMI - Compact Economic Context
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-2 pt-2 border-t border-border-primary/20">
          {/* CPI Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-surface-secondary/30 flex-1">
            <span className="text-[9px] font-medium text-text-muted uppercase tracking-wider">CPI</span>
            <div className="flex items-center gap-1 ml-auto">
              {cpiActual !== null && cpiActual !== undefined && (
                <span className="text-xs font-mono text-text-secondary">{formatNumber(cpiActual)}%</span>
              )}
              <span className={`text-[10px] font-semibold ${getTrendColor(inflationTrend)}`}>
                {getTrendIcon(inflationTrend)}
              </span>
            </div>
          </div>

          {/* PMI Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-surface-secondary/30 flex-1">
            <span className="text-[9px] font-medium text-text-muted uppercase tracking-wider">PMI</span>
            <div className="flex items-center gap-1 ml-auto">
              {pmiActual !== null && pmiActual !== undefined && (
                <span className="text-xs font-mono text-text-secondary">{formatNumber(pmiActual)}</span>
              )}
              <span className={`text-[10px] font-semibold ${getTrendColor(pmiSignal)}`}>
                {getTrendIcon(pmiSignal)}
              </span>
            </div>
          </div>
        </div>

        {/* AI Justification */}
        {aiJustification && (
          <div className="mt-3 pt-3 border-t border-border-primary/20">
            <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2 italic">
              {aiJustification}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
