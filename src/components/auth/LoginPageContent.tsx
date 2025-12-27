'use client';

import { useState } from 'react';
import HomepageLogin from './HomepageLogin';
import AccessRequestModal from './AccessRequestModal';
import { LOGO_BASE64 } from '@/constants/logo';

// Size type for floating items
type FloatingSize = 'sm' | 'md' | 'lg' | 'xl';

// Floating forex data for the background
const floatingItems: Array<{
  pair: string;
  type: 'bullish' | 'bearish';
  size: FloatingSize;
  position: React.CSSProperties;
  delay: string;
}> = [
  { pair: 'GBP/JPY', type: 'bullish', size: 'lg', position: { top: '8%', left: '5%' }, delay: '0s' },
  { pair: 'EUR/USD', type: 'bearish', size: 'xl', position: { top: '15%', right: '8%' }, delay: '0.5s' },
  { pair: 'NZD/CHF', type: 'bullish', size: 'md', position: { top: '5%', right: '25%' }, delay: '1s' },
  { pair: 'USD/CAD', type: 'bearish', size: 'lg', position: { top: '25%', left: '12%' }, delay: '1.5s' },
  { pair: 'GOLD', type: 'bullish', size: 'xl', position: { bottom: '20%', left: '8%' }, delay: '2s' },
  { pair: 'AUD/CAD', type: 'bullish', size: 'md', position: { top: '12%', left: '25%' }, delay: '2.5s' },
  { pair: 'US30', type: 'bearish', size: 'sm', position: { top: '30%', right: '5%' }, delay: '3s' },
  { pair: 'SILVER', type: 'bearish', size: 'md', position: { bottom: '35%', right: '10%' }, delay: '3.5s' },
  { pair: 'EUR/GBP', type: 'bullish', size: 'sm', position: { bottom: '15%', right: '25%' }, delay: '4s' },
  { pair: 'USD/JPY', type: 'bearish', size: 'lg', position: { bottom: '10%', left: '20%' }, delay: '4.5s' },
  { pair: 'AUD/USD', type: 'bullish', size: 'sm', position: { top: '40%', left: '3%' }, delay: '5s' },
  { pair: 'CHF/JPY', type: 'bearish', size: 'md', position: { bottom: '25%', right: '3%' }, delay: '5.5s' },
  { pair: 'GBP/USD', type: 'bullish', size: 'sm', position: { top: '50%', right: '15%' }, delay: '6s' },
  { pair: 'NZD/USD', type: 'bearish', size: 'sm', position: { bottom: '40%', left: '15%' }, delay: '6.5s' },
];

interface FloatingItemProps {
  pair: string;
  type: 'bullish' | 'bearish';
  size: FloatingSize;
  position: React.CSSProperties;
  delay: string;
}

function FloatingItem({ pair, type, size, position, delay }: FloatingItemProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  const opacityClasses = {
    sm: 'opacity-20',
    md: 'opacity-30',
    lg: 'opacity-40',
    xl: 'opacity-50',
  };

  const isBullish = type === 'bullish';
  const arrows = isBullish ? '↗↗↗' : '↘↘↘';
  const colorClass = isBullish ? 'text-sentiment-bullish' : 'text-sentiment-bearish';

  return (
    <div
      className={`absolute font-mono font-bold whitespace-nowrap select-none pointer-events-none animate-float ${sizeClasses[size]} ${opacityClasses[size]}`}
      style={{
        ...position,
        animationDelay: delay,
        animationDuration: `${8 + Math.random() * 4}s`,
      }}
    >
      <span className={colorClass}>{arrows}</span>
      <span className="text-text-secondary ml-1">{pair}</span>
    </div>
  );
}

export default function LoginPageContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background-primary relative overflow-hidden">
      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/5 via-transparent to-sentiment-bearish/5 pointer-events-none" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Floating forex pairs background */}
      <div className="absolute inset-0 overflow-hidden">
        {floatingItems.map((item, index) => (
          <FloatingItem key={index} {...item} />
        ))}
      </div>

      {/* Radial glow behind the card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-blue/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="bg-surface-primary/90 backdrop-blur-xl border border-border-primary/50 rounded-2xl p-8 shadow-2xl shadow-black/50">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="w-24 h-24 mx-auto mb-4 bg-accent-blue/20 rounded-full flex items-center justify-center">
                <img
                  src={LOGO_BASE64}
                  alt="Daghandelaren Logo"
                  className="w-28 h-28 object-contain drop-shadow-lg"
                />
              </div>
              <h1 className="text-3xl font-bold text-text-primary tracking-tight">
                Daghandelaren
              </h1>
              <p className="text-text-secondary text-sm mt-2 tracking-wide uppercase">
                Trading Dashboard
              </p>
            </div>

            {/* Login Form */}
            <HomepageLogin />

            {/* Request Access Link */}
            <div className="mt-6 pt-6 border-t border-border-primary/50 text-center">
              <p className="text-text-muted text-sm">
                Need access?{' '}
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="text-accent-cyan hover:text-accent-cyan/80 font-medium transition-colors"
                >
                  Request here
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Access Request Modal */}
      <AccessRequestModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
