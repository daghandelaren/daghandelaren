'use client';

import type { RiskSentiment } from '@/types';

interface RiskSentimentCardProps {
  data: RiskSentiment;
}

export default function RiskSentimentCard({ data }: RiskSentimentCardProps) {
  const { status, riskScore, safeHavenScore, delta } = data;

  // Status styling
  const getStatusConfig = () => {
    switch (status) {
      case 'RISK-ON':
        return {
          color: 'text-sentiment-bullish',
          bgGlow: 'bg-sentiment-bullish/10',
          barColor: 'bg-sentiment-bullish',
          shadowColor: 'shadow-sentiment-bullish/20',
          icon: '▲',
        };
      case 'RISK-OFF':
        return {
          color: 'text-sentiment-bearish',
          bgGlow: 'bg-sentiment-bearish/10',
          barColor: 'bg-sentiment-bearish',
          shadowColor: 'shadow-sentiment-bearish/20',
          icon: '▼',
        };
      default:
        return {
          color: 'text-gray-400',
          bgGlow: 'bg-gray-500/10',
          barColor: 'bg-gray-500',
          shadowColor: 'shadow-gray-500/20',
          icon: '◆',
        };
    }
  };

  const config = getStatusConfig();

  // Calculate gauge position (delta from -30 to +30 mapped to 0-100%)
  const gaugePosition = Math.max(0, Math.min(100, ((delta + 30) / 60) * 100));

  return (
    <div className="bg-background-secondary rounded-lg p-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${config.barColor} animate-pulse`} />
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
          Risk Sentiment
        </h3>
      </div>

      {/* Status Display */}
      <div className={`relative rounded-lg p-4 mb-4 ${config.bgGlow}`}>
        {/* Main Status */}
        <div className="text-center">
          <span className={`text-xs font-mono text-text-muted mb-1 block`}>
            MARKET BIAS
          </span>
          <div className={`text-2xl font-bold tracking-tight ${config.color} flex items-center justify-center gap-2`}>
            <span className="text-lg opacity-70">{config.icon}</span>
            {status}
          </div>
        </div>
      </div>

      {/* Gauge */}
      <div className="mb-4">
        {/* Scale labels */}
        <div className="flex justify-between mb-1 text-[10px] font-mono text-text-muted">
          <span>RISK-OFF</span>
          <span className="text-text-muted/50">|</span>
          <span>RISK-ON</span>
        </div>

        {/* Gauge track */}
        <div className="relative h-2 bg-surface-secondary/50 rounded-full overflow-hidden">
          {/* Gradient background */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: 'linear-gradient(to right, rgb(239, 68, 68), rgb(107, 114, 128) 50%, rgb(34, 197, 94))',
            }}
          />

          {/* Center marker */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30 -translate-x-0.5" />

          {/* Position indicator */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${config.barColor} border-2 border-white/80 transition-all duration-500 ease-out`}
            style={{
              left: `${gaugePosition}%`,
              transform: `translate(-50%, -50%)`,
              boxShadow: `0 0 8px ${status === 'RISK-ON' ? 'rgba(34, 197, 94, 0.5)' : status === 'RISK-OFF' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(107, 114, 128, 0.5)'}`,
            }}
          />
        </div>

        {/* Delta value */}
        <div className="text-center mt-2">
          <span className={`text-sm font-mono font-semibold ${config.color}`}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-2">
        {/* Risk currencies */}
        <div className="bg-surface-secondary/30 rounded px-2 py-1.5">
          <div className="text-[10px] font-mono text-text-muted mb-0.5">
            RISK (AUD/NZD/CAD)
          </div>
          <div className={`text-sm font-mono font-semibold ${riskScore >= 0 ? 'text-sentiment-bullish' : 'text-sentiment-bearish'}`}>
            {riskScore >= 0 ? '+' : ''}{riskScore.toFixed(1)}
          </div>
        </div>

        {/* Safe haven currencies */}
        <div className="bg-surface-secondary/30 rounded px-2 py-1.5">
          <div className="text-[10px] font-mono text-text-muted mb-0.5">
            SAFE (JPY/CHF)
          </div>
          <div className={`text-sm font-mono font-semibold ${safeHavenScore >= 0 ? 'text-sentiment-bullish' : 'text-sentiment-bearish'}`}>
            {safeHavenScore >= 0 ? '+' : ''}{safeHavenScore.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}
