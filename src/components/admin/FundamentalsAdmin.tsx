'use client';

import { useState, useEffect } from 'react';

interface CurrencyData {
  currency: string;
  inflationTrend: string;
  pmiSignal: string;
  centralBankTone: string;
  rateDifferential: string;
  commodityTailwind: string;
  totalScore: number;
  rating: string;
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
  lastUpdated?: string;
}

const INDICATOR_OPTIONS = {
  inflationTrend: ['Up', 'Flat', 'Down'],
  pmiSignal: ['Up', 'Flat', 'Down'],
  centralBankTone: ['Hawkish', 'Neutral', 'Dovish'],
  rateDifferential: ['Up', 'Flat', 'Down'],
  commodityTailwind: ['Yes', 'Neutral', 'No'],
};

export default function FundamentalsAdmin() {
  const [currencies, setCurrencies] = useState<CurrencyData[]>([]);
  const [settings, setSettings] = useState<Settings>({
    riskRegime: 'Neutral',
    riskSentimentJustification: null,
    bullishThreshold: 3,
    bearishThreshold: -3,
  });
  const [aiConfigured, setAiConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CurrencyData>>({});
  const [scrapingCpi, setScrapingCpi] = useState(false);
  const [scrapingPmi, setScrapingPmi] = useState(false);
  const [scrapingYields, setScrapingYields] = useState(false);
  const [scrapingCommodities, setScrapingCommodities] = useState(false);
  const [scrapingFred, setScrapingFred] = useState(false);
  const [dataUpdateLog, setDataUpdateLog] = useState<{
    cpi: string | null;
    pmi: string | null;
    yields: string | null;
    commodities: string | null;
    fred: string | null;
  }>({ cpi: null, pmi: null, yields: null, commodities: null, fred: null });

  // Fetch data
  const fetchData = async () => {
    try {
      const res = await fetch('/api/fundamental');
      const data = await res.json();
      setCurrencies(data.currencies || []);
      setSettings(data.settings || settings);
      setAiConfigured(data.aiConfigured || false);
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data update status
  const fetchDataStatus = async () => {
    try {
      const res = await fetch('/api/fundamental/data-status');
      const data = await res.json();
      setDataUpdateLog(data);
    } catch (error) {
      console.error('Failed to fetch data status:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchDataStatus();
  }, []);

  // Update settings
  const updateSettings = async (key: keyof Settings, value: string | number) => {
    try {
      const res = await fetch('/api/fundamental/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (res.ok) {
        setSettings({ ...settings, [key]: value });
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  // Start editing a currency
  const startEdit = (currency: CurrencyData) => {
    setEditingCurrency(currency.currency);
    setEditForm({
      inflationTrend: currency.inflationTrend,
      pmiSignal: currency.pmiSignal,
      centralBankTone: currency.centralBankTone,
      rateDifferential: currency.rateDifferential,
      commodityTailwind: currency.commodityTailwind,
    });
  };

  // Save currency edit
  const saveEdit = async () => {
    if (!editingCurrency) return;

    setSaving(editingCurrency);
    try {
      const res = await fetch('/api/fundamental', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: editingCurrency,
          ...editForm,
        }),
      });

      if (res.ok) {
        await fetchData();
        setEditingCurrency(null);
        setEditForm({});
      }
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(null);
    }
  };

  // Run AI analysis
  const runAnalysis = async () => {
    if (!confirm('Run AI analysis? This will update all currencies (except manual overrides).')) return;

    setAnalyzing(true);
    try {
      const res = await fetch('/api/fundamental/analyze', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        await fetchData();
        alert('Analysis complete!');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Failed to run analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  // Clear manual override
  const clearOverride = async (currency: string) => {
    if (!confirm(`Clear manual override for ${currency}?`)) return;

    try {
      const res = await fetch('/api/fundamental', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency,
          manualOverride: false,
        }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to clear override:', error);
    }
  };

  // Scrape CPI data from Trading Economics
  const scrapeCpiData = async () => {
    if (!confirm('Scrape CPI data from Trading Economics?')) return;

    setScrapingCpi(true);
    try {
      const res = await fetch('/api/fundamental/economic-data', { method: 'POST' });
      const data = await res.json();

      if (data.success !== false) {
        await fetchData();
        await fetchDataStatus();
        alert(`CPI data updated: ${data.updated || 0} currencies`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('CPI scrape error:', error);
      alert('Failed to scrape CPI data');
    } finally {
      setScrapingCpi(false);
    }
  };

  // Scrape PMI data from Trading Economics
  const scrapePmiData = async () => {
    if (!confirm('Scrape PMI data from Trading Economics?')) return;

    setScrapingPmi(true);
    try {
      const res = await fetch('/api/fundamental/pmi-data', { method: 'POST' });
      const data = await res.json();

      if (data.success !== false) {
        await fetchData();
        await fetchDataStatus();
        alert(`PMI data updated: ${data.updated || 0} currencies`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('PMI scrape error:', error);
      alert('Failed to scrape PMI data');
    } finally {
      setScrapingPmi(false);
    }
  };

  // Scrape Yield data from Trading Economics
  const scrapeYieldsData = async () => {
    if (!confirm('Scrape Yield data from Trading Economics?')) return;

    setScrapingYields(true);
    try {
      const res = await fetch('/api/fundamental/yields-data', { method: 'POST' });
      const data = await res.json();

      if (data.success !== false) {
        await fetchData();
        await fetchDataStatus();
        alert(`Yield data updated: ${data.updated || 0} currencies`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Yield scrape error:', error);
      alert('Failed to scrape Yield data');
    } finally {
      setScrapingYields(false);
    }
  };

  // Scrape Commodity data from Trading Economics
  const scrapeCommoditiesData = async () => {
    if (!confirm('Scrape Commodity data from Trading Economics?')) return;

    setScrapingCommodities(true);
    try {
      const res = await fetch('/api/fundamental/commodities-data', { method: 'POST' });
      const data = await res.json();

      if (data.success !== false) {
        await fetchData();
        await fetchDataStatus();
        alert(`Commodity data updated: ${data.updated || 0} commodities`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Commodity scrape error:', error);
      alert('Failed to scrape Commodity data');
    } finally {
      setScrapingCommodities(false);
    }
  };

  // Scrape FRED data (VIX, US 2Y Yield, WTI Oil)
  const scrapeFredData = async () => {
    if (!confirm('Fetch FRED data (VIX, US 2Y Yield, WTI Oil)?')) return;

    setScrapingFred(true);
    try {
      const res = await fetch('/api/fundamental/fred-data', { method: 'POST' });
      const data = await res.json();

      if (data.success !== false) {
        await fetchData();
        await fetchDataStatus();
        alert(`FRED data updated: VIX(${data.details?.vix || 0}), US2Y(${data.details?.usYield || 0}), Oil(${data.details?.oil || 0})`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('FRED scrape error:', error);
      alert('Failed to fetch FRED data');
    } finally {
      setScrapingFred(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-surface-secondary rounded-lg" />
        <div className="h-96 bg-surface-secondary rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Settings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Risk Regime</label>
            <select
              value={settings.riskRegime}
              onChange={(e) => updateSettings('riskRegime', e.target.value)}
              className="w-full bg-surface-secondary border border-border-primary rounded-lg px-3 py-2 text-text-primary"
            >
              <option value="Risk-on">Risk-on</option>
              <option value="Neutral">Neutral</option>
              <option value="Risk-off">Risk-off</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Bullish Threshold</label>
            <input
              type="number"
              value={settings.bullishThreshold}
              onChange={(e) => updateSettings('bullishThreshold', parseInt(e.target.value))}
              className="w-full bg-surface-secondary border border-border-primary rounded-lg px-3 py-2 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Bearish Threshold</label>
            <input
              type="number"
              value={settings.bearishThreshold}
              onChange={(e) => updateSettings('bearishThreshold', parseInt(e.target.value))}
              className="w-full bg-surface-secondary border border-border-primary rounded-lg px-3 py-2 text-text-primary"
            />
          </div>
        </div>
      </div>

      {/* AI Controls */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">AI Analysis</h3>
            <p className="text-sm text-text-muted mt-1">
              {aiConfigured
                ? 'Gemini API is configured and ready'
                : 'Add GEMINI_API_KEY to enable AI analysis'}
            </p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={!aiConfigured || analyzing}
            className="px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {analyzing && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            )}
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>

        {/* Risk Sentiment Justification */}
        {settings.riskSentimentJustification && (
          <div className="mt-4 pt-4 border-t border-border-primary">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-text-primary">Risk Sentiment:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                settings.riskRegime === 'Risk-on'
                  ? 'bg-sentiment-bullish/20 text-sentiment-bullish'
                  : settings.riskRegime === 'Risk-off'
                    ? 'bg-sentiment-bearish/20 text-sentiment-bearish'
                    : 'bg-gray-500/20 text-gray-400'
              }`}>
                {settings.riskRegime}
              </span>
              {settings.lastUpdated && (
                <span className="text-xs text-text-muted">
                  Updated: {new Date(settings.lastUpdated).toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-sm text-text-secondary">{settings.riskSentimentJustification}</p>
          </div>
        )}
      </div>

      {/* Trading Economics Data Controls */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Trading Economics Data</h3>
            <p className="text-sm text-text-muted mt-1">
              Manually scrape economic data from Trading Economics
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={scrapeCpiData}
              disabled={scrapingCpi}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {scrapingCpi && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              )}
              {scrapingCpi ? 'Scraping...' : 'Scrape CPI'}
            </button>
            <button
              onClick={scrapePmiData}
              disabled={scrapingPmi}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {scrapingPmi && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              )}
              {scrapingPmi ? 'Scraping...' : 'Scrape PMI'}
            </button>
            <button
              onClick={scrapeYieldsData}
              disabled={scrapingYields}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {scrapingYields && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              )}
              {scrapingYields ? 'Scraping...' : 'Scrape Yields'}
            </button>
            <button
              onClick={scrapeCommoditiesData}
              disabled={scrapingCommodities}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {scrapingCommodities && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              )}
              {scrapingCommodities ? 'Scraping...' : 'Scrape Commodities'}
            </button>
            <button
              onClick={scrapeFredData}
              disabled={scrapingFred}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {scrapingFred && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              )}
              {scrapingFred ? 'Fetching...' : 'Fetch FRED Data'}
            </button>
          </div>
        </div>

        {/* Data Update Log */}
        <div className="border-t border-border-primary pt-4">
          <h4 className="text-sm font-medium text-text-primary mb-3">Last Updated</h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="p-3 bg-surface-secondary rounded-lg">
              <div className="text-xs text-text-muted mb-1">CPI</div>
              <div className="text-sm text-text-primary font-mono">
                {dataUpdateLog.cpi
                  ? new Date(dataUpdateLog.cpi).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              </div>
            </div>
            <div className="p-3 bg-surface-secondary rounded-lg">
              <div className="text-xs text-text-muted mb-1">PMI</div>
              <div className="text-sm text-text-primary font-mono">
                {dataUpdateLog.pmi
                  ? new Date(dataUpdateLog.pmi).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              </div>
            </div>
            <div className="p-3 bg-surface-secondary rounded-lg">
              <div className="text-xs text-text-muted mb-1">Yields</div>
              <div className="text-sm text-text-primary font-mono">
                {dataUpdateLog.yields
                  ? new Date(dataUpdateLog.yields).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              </div>
            </div>
            <div className="p-3 bg-surface-secondary rounded-lg">
              <div className="text-xs text-text-muted mb-1">Commodities</div>
              <div className="text-sm text-text-primary font-mono">
                {dataUpdateLog.commodities
                  ? new Date(dataUpdateLog.commodities).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              </div>
            </div>
            <div className="p-3 bg-surface-secondary rounded-lg">
              <div className="text-xs text-text-muted mb-1">FRED (VIX/Oil)</div>
              <div className="text-sm text-text-primary font-mono">
                {dataUpdateLog.fred
                  ? new Date(dataUpdateLog.fred).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Currency Data Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border-primary">
          <h3 className="text-lg font-semibold text-text-primary">Currency Data</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-text-muted">Currency</th>
                <th className="text-left py-3 px-4 font-medium text-text-muted">Inflation</th>
                <th className="text-left py-3 px-4 font-medium text-text-muted">PMI</th>
                <th className="text-left py-3 px-4 font-medium text-text-muted">CB Tone</th>
                <th className="text-left py-3 px-4 font-medium text-text-muted">Rate Diff</th>
                <th className="text-left py-3 px-4 font-medium text-text-muted">Commodity</th>
                <th className="text-center py-3 px-4 font-medium text-text-muted">Score</th>
                <th className="text-center py-3 px-4 font-medium text-text-muted">Rating</th>
                <th className="text-right py-3 px-4 font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((currency) => (
                <tr key={currency.currency} className="border-t border-border-primary/50 hover:bg-surface-hover">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary">{currency.currency}</span>
                      {currency.manualOverride && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-accent-blue/20 text-accent-blue rounded">
                          MANUAL
                        </span>
                      )}
                    </div>
                  </td>

                  {editingCurrency === currency.currency ? (
                    <>
                      {(['inflationTrend', 'pmiSignal', 'centralBankTone', 'rateDifferential', 'commodityTailwind'] as const).map((key) => (
                        <td key={key} className="py-2 px-2">
                          <select
                            value={editForm[key] || ''}
                            onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                            className="w-full bg-surface-secondary border border-border-primary rounded px-2 py-1 text-xs text-text-primary"
                          >
                            {INDICATOR_OPTIONS[key].map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </td>
                      ))}
                      <td className="py-3 px-4 text-center font-mono text-text-muted">-</td>
                      <td className="py-3 px-4 text-center text-text-muted">-</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={saveEdit}
                            disabled={saving === currency.currency}
                            className="px-2 py-1 bg-sentiment-bullish text-white rounded text-xs hover:bg-sentiment-bullish/90 disabled:opacity-50"
                          >
                            {saving === currency.currency ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingCurrency(null);
                              setEditForm({});
                            }}
                            className="px-2 py-1 bg-surface-secondary text-text-secondary rounded text-xs hover:bg-surface-hover"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-4 text-text-secondary">{currency.inflationTrend}</td>
                      <td className="py-3 px-4 text-text-secondary">{currency.pmiSignal}</td>
                      <td className="py-3 px-4 text-text-secondary">{currency.centralBankTone}</td>
                      <td className="py-3 px-4 text-text-secondary">{currency.rateDifferential}</td>
                      <td className="py-3 px-4 text-text-secondary">{currency.commodityTailwind}</td>
                      <td className={`py-3 px-4 text-center font-mono font-medium ${
                        currency.totalScore > 0 ? 'text-sentiment-bullish' : currency.totalScore < 0 ? 'text-sentiment-bearish' : 'text-gray-400'
                      }`}>
                        {currency.totalScore > 0 ? '+' : ''}{currency.totalScore}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          currency.rating === 'Bullish'
                            ? 'bg-sentiment-bullish/20 text-sentiment-bullish'
                            : currency.rating === 'Bearish'
                              ? 'bg-sentiment-bearish/20 text-sentiment-bearish'
                              : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {currency.rating}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(currency)}
                            className="px-2 py-1 bg-surface-secondary text-text-secondary rounded text-xs hover:bg-surface-hover hover:text-text-primary"
                          >
                            Edit
                          </button>
                          {currency.manualOverride && (
                            <button
                              onClick={() => clearOverride(currency.currency)}
                              className="px-2 py-1 bg-sentiment-bearish/20 text-sentiment-bearish rounded text-xs hover:bg-sentiment-bearish/30"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Justifications */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">AI Justifications</h3>
        <div className="space-y-3">
          {currencies.filter(c => c.aiJustification).map((currency) => (
            <div key={currency.currency} className="p-3 bg-surface-secondary rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-text-primary">{currency.currency}</span>
                <span className="text-xs text-text-muted">
                  Updated: {new Date(currency.lastUpdated).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-text-secondary">{currency.aiJustification}</p>
            </div>
          ))}
          {currencies.filter(c => c.aiJustification).length === 0 && (
            <p className="text-text-muted text-center py-4">
              No AI justifications yet. Run an analysis to generate them.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
