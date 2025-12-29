'use client';

interface CurrencyScoreCardProps {
  currency: string;
  totalScore: number;
  rating: string;
  inflationTrend: string;
  pmiSignal: string;
  centralBankTone: string;
  rateDifferential: string;
  creditConditions: string;
  commodityTailwind: string;
  cpiActual?: number | null;
  cpiPrevious?: number | null;
  pmiActual?: number | null;
  pmiPrevious?: number | null;
  aiJustification?: string | null;
  manualOverride?: boolean;
  onClick?: () => void;
}

export default function CurrencyScoreCard({
  currency,
  totalScore,
  rating,
  inflationTrend,
  pmiSignal,
  centralBankTone,
  rateDifferential,
  creditConditions,
  commodityTailwind,
  cpiActual,
  cpiPrevious,
  pmiActual,
  pmiPrevious,
  aiJustification,
  manualOverride,
  onClick,
}: CurrencyScoreCardProps) {
  const getRatingGlow = (rating: string) => {
    switch (rating) {
      case 'Bullish':
        return 'shadow-[0_0_20px_-5px_rgba(34,197,94,0.3)]';
      case 'Bearish':
        return 'shadow-[0_0_20px_-5px_rgba(239,68,68,0.3)]';
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

  const getScoreBg = (score: number) => {
    if (score > 0) return 'bg-sentiment-bullish/10';
    if (score < 0) return 'bg-sentiment-bearish/10';
    return 'bg-gray-500/10';
  };

  const getTrendColor = (value: string) => {
    if (['Up', 'Hawkish', 'Easing', 'Yes', 'Positive', 'Rising'].includes(value)) {
      return 'text-sentiment-bullish';
    }
    if (['Down', 'Dovish', 'Tightening', 'No', 'Negative', 'Falling'].includes(value)) {
      return 'text-sentiment-bearish';
    }
    return 'text-gray-400';
  };

  const getTrendIcon = (value: string) => {
    if (['Up', 'Hawkish', 'Easing', 'Yes', 'Positive', 'Rising'].includes(value)) {
      return '↑';
    }
    if (['Down', 'Dovish', 'Tightening', 'No', 'Negative', 'Falling'].includes(value)) {
      return '↓';
    }
    return '→';
  };

  const formatNumber = (val: number | null | undefined) => {
    if (val === null || val === undefined) return null;
    return val.toFixed(1);
  };

  const otherIndicators = [
    { label: 'Central Bank', value: centralBankTone },
    { label: 'Rate Diff', value: rateDifferential },
    { label: 'Credit', value: creditConditions },
    { label: 'Commodity', value: commodityTailwind },
  ];

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

          <div className={`flex flex-col items-end`}>
            <div className={`text-3xl font-mono font-bold tracking-tighter ${getScoreColor(totalScore)}`}>
              {totalScore > 0 ? '+' : ''}{totalScore}
            </div>
            <span className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Score</span>
          </div>
        </div>

        {/* Economic Data Section */}
        <div className="space-y-3 mb-4">
          {/* Inflation Row */}
          <div className="bg-surface-secondary/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Inflation</span>
              <div className={`flex items-center gap-1.5 font-semibold text-sm ${getTrendColor(inflationTrend)}`}>
                <span>{getTrendIcon(inflationTrend)}</span>
                <span>{inflationTrend}</span>
              </div>
            </div>
            {(cpiActual !== null && cpiActual !== undefined) && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-lg font-mono font-semibold text-text-primary">
                  {formatNumber(cpiActual)}%
                </span>
                {cpiPrevious !== null && cpiPrevious !== undefined && (
                  <>
                    <span className="text-text-muted">←</span>
                    <span className="text-sm font-mono text-text-muted">
                      {formatNumber(cpiPrevious)}%
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* PMI Row */}
          <div className="bg-surface-secondary/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Services PMI</span>
              <div className={`flex items-center gap-1.5 font-semibold text-sm ${getTrendColor(pmiSignal)}`}>
                <span>{getTrendIcon(pmiSignal)}</span>
                <span>{pmiSignal}</span>
              </div>
            </div>
            {(pmiActual !== null && pmiActual !== undefined) && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-lg font-mono font-semibold text-text-primary">
                  {formatNumber(pmiActual)}
                </span>
                {pmiPrevious !== null && pmiPrevious !== undefined && (
                  <>
                    <span className="text-text-muted">←</span>
                    <span className="text-sm font-mono text-text-muted">
                      {formatNumber(pmiPrevious)}
                    </span>
                  </>
                )}
                {pmiActual !== null && (
                  <span className={`text-xs ml-auto ${pmiActual >= 50 ? 'text-sentiment-bullish' : 'text-sentiment-bearish'}`}>
                    {pmiActual >= 50 ? 'Expansion' : 'Contraction'}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Other Indicators Grid */}
        <div className="grid grid-cols-2 gap-2">
          {otherIndicators.map(({ label, value }) => (
            <div key={label} className="flex flex-col p-2 rounded-md bg-surface-secondary/30">
              <span className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">{label}</span>
              <span className={`text-sm font-medium ${getTrendColor(value)}`}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* AI Justification */}
        {aiJustification && (
          <div className="mt-4 pt-3 border-t border-border-primary/30">
            <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
              {aiJustification}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
