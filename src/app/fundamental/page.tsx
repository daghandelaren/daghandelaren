'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import MegaMenu from '@/components/layout/MegaMenu';
import CurrencyScoreCard from '@/components/fundamental/CurrencyScoreCard';

interface CurrencyScore {
  currency: string;
  totalScore: number;
  rating: string;
  inflationTrend: string;
  pmiSignal: string;
  centralBankTone: string;
  rateDifferential: string;
  creditConditions: string;
  commodityTailwind: string;
  cpiActual: number | null;
  cpiPrevious: number | null;
  pmiActual: number | null;
  pmiPrevious: number | null;
  aiJustification: string | null;
  manualOverride: boolean;
  lastUpdated: string;
  updatedBy: string | null;
}

interface Settings {
  riskRegime: string;
  riskSentimentJustification: string | null;
  bullishThreshold: number;
  bearishThreshold: number;
}

export default function FundamentalPage() {
  const { data: session } = useSession();
  const [currencies, setCurrencies] = useState<CurrencyScore[]>([]);
  const [settings, setSettings] = useState<Settings>({
    riskRegime: 'Neutral',
    riskSentimentJustification: null,
    bullishThreshold: 3,
    bearishThreshold: -3,
  });
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyScore | null>(null);
  const [showRiskModal, setShowRiskModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/fundamental');
        const data = await res.json();
        setCurrencies(data.currencies || []);
        setSettings(data.settings || settings);
      } catch (error) {
        console.error('Failed to fetch fundamental data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const isAdmin = session?.user?.role === 'ADMIN';

  if (loading) {
    return (
      <div className="min-h-screen bg-background-primary">
        <MegaMenu userEmail={session?.user?.email || ''} isAdmin={isAdmin} />
        <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
          <div className="space-y-6 animate-pulse">
            <div className="h-12 bg-surface-secondary rounded-lg w-64" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-72 bg-surface-secondary rounded-xl" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary">
      <MegaMenu userEmail={session?.user?.email || ''} isAdmin={isAdmin} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-end mb-6">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span>Risk Regime:</span>
            <button
              onClick={() => setShowRiskModal(true)}
              className={`px-3 py-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity font-medium ${
                settings.riskRegime === 'Risk-on' ? 'bg-green-500/20 text-green-400' :
                settings.riskRegime === 'Risk-off' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}
              title="Click to see AI reasoning"
            >
              {settings.riskRegime}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {currencies.map((currency) => (
            <CurrencyScoreCard
              key={currency.currency}
              currency={currency.currency}
              totalScore={currency.totalScore}
              rating={currency.rating}
              inflationTrend={currency.inflationTrend}
              pmiSignal={currency.pmiSignal}
              centralBankTone={currency.centralBankTone}
              rateDifferential={currency.rateDifferential}
              creditConditions={currency.creditConditions}
              commodityTailwind={currency.commodityTailwind}
              cpiActual={currency.cpiActual}
              cpiPrevious={currency.cpiPrevious}
              pmiActual={currency.pmiActual}
              pmiPrevious={currency.pmiPrevious}
              aiJustification={currency.aiJustification}
              manualOverride={currency.manualOverride}
              onClick={() => setSelectedCurrency(currency)}
            />
          ))}
        </div>

        {currencies.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-text-muted">No fundamental data yet. Run analysis from the Admin panel.</p>
          </div>
        )}

        {selectedCurrency && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedCurrency(null)}
          >
            <div
              className="bg-surface-primary border border-border-primary rounded-lg max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-text-primary">
                  {selectedCurrency.currency} Analysis
                </h3>
                <button
                  onClick={() => setSelectedCurrency(null)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">Score</span>
                  <span className={`font-bold ${
                    selectedCurrency.totalScore > 0 ? 'text-sentiment-bullish' :
                    selectedCurrency.totalScore < 0 ? 'text-sentiment-bearish' :
                    'text-gray-400'
                  }`}>
                    {selectedCurrency.totalScore > 0 ? '+' : ''}{selectedCurrency.totalScore}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">Rating</span>
                  <span className={`font-semibold ${
                    selectedCurrency.rating === 'Bullish' ? 'text-sentiment-bullish' :
                    selectedCurrency.rating === 'Bearish' ? 'text-sentiment-bearish' :
                    'text-gray-400'
                  }`}>
                    {selectedCurrency.rating}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">Last Updated</span>
                  <span className="text-text-secondary">
                    {new Date(selectedCurrency.lastUpdated).toLocaleString()}
                  </span>
                </div>
                <hr className="border-border-primary" />
                <div>
                  <p className="text-sm font-medium text-text-primary mb-2">AI Justification</p>
                  <p className="text-sm text-text-muted">
                    {selectedCurrency.aiJustification || 'No AI justification available.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {showRiskModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowRiskModal(false)}
          >
            <div
              className="bg-surface-primary border border-border-primary rounded-lg max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-text-primary">
                  Risk Sentiment: {settings.riskRegime}
                </h3>
                <button
                  onClick={() => setShowRiskModal(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className={`inline-block px-3 py-1.5 rounded text-sm font-semibold mb-4 ${
                settings.riskRegime === 'Risk-on' ? 'bg-green-500/20 text-green-400' :
                settings.riskRegime === 'Risk-off' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {settings.riskRegime}
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">AI Justification</p>
                <p className="text-sm text-text-muted">
                  {settings.riskSentimentJustification || 'No AI justification available. Run AI analysis to get reasoning.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
