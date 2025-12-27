interface TrendArrowProps {
  value: number;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function TrendArrow({ value, showValue = false, size = 'md' }: TrendArrowProps) {
  const isPositive = value > 0;
  const isNeutral = Math.abs(value) < 0.5;

  const sizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  if (isNeutral) {
    return (
      <div className="flex items-center gap-1 text-sentiment-neutral">
        <svg className={sizes[size]} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
        {showValue && <span className={textSizes[size]}>{value.toFixed(1)}%</span>}
      </div>
    );
  }

  if (isPositive) {
    return (
      <div className="flex items-center gap-1 text-sentiment-bullish">
        <svg className={sizes[size]} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
        {showValue && <span className={textSizes[size]}>+{value.toFixed(1)}%</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sentiment-bearish">
      <svg className={sizes[size]} fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      {showValue && <span className={textSizes[size]}>{value.toFixed(1)}%</span>}
    </div>
  );
}
