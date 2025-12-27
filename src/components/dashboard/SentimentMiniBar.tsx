'use client';

interface SentimentMiniBarProps {
  longPercent: number;
  shortPercent: number;
  showLabels?: boolean;
  className?: string;
}

export default function SentimentMiniBar({
  longPercent,
  shortPercent,
  showLabels = false,
  className = '',
}: SentimentMiniBarProps) {
  // Ensure values are within bounds
  const long = Math.max(0, Math.min(100, longPercent));
  const short = Math.max(0, Math.min(100, shortPercent));

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabels && (
        <span className="text-xs font-mono text-sentiment-bullish w-10 text-right">
          {long.toFixed(0)}%
        </span>
      )}

      <div className="relative w-20 h-2 bg-surface-secondary rounded-full overflow-hidden">
        {/* Long (green) portion */}
        <div
          className="absolute inset-y-0 left-0 bg-sentiment-bullish/80 transition-all duration-300"
          style={{ width: `${long}%` }}
        />
        {/* Short (red) portion */}
        <div
          className="absolute inset-y-0 right-0 bg-sentiment-bearish/80 transition-all duration-300"
          style={{ width: `${short}%` }}
        />

        {/* Center line indicator when close to 50/50 */}
        {Math.abs(long - 50) < 5 && (
          <div className="absolute inset-y-0 left-1/2 w-px bg-text-muted/50 transform -translate-x-1/2" />
        )}
      </div>

      {showLabels && (
        <span className="text-xs font-mono text-sentiment-bearish w-10">
          {short.toFixed(0)}%
        </span>
      )}
    </div>
  );
}
