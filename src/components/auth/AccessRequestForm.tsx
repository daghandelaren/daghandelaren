'use client';

import { useState } from 'react';

export default function AccessRequestForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setError('');

    try {
      const response = await fetch('/api/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, reason }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit request');
      }

      setStatus('success');
      setName('');
      setEmail('');
      setReason('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 bg-sentiment-bullish/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-sentiment-bullish" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-text-primary mb-1">Request Submitted</h3>
        <p className="text-text-secondary text-sm">
          Thanks for your request. You&apos;ll hear from us if access is granted.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-sentiment-bearish/20 border border-sentiment-bearish/50 text-sentiment-bearish px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="req-name" className="block text-sm font-medium text-text-secondary mb-1">
          Full Name
        </label>
        <input
          id="req-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 bg-background-primary border border-border-primary rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
          placeholder="Your name"
        />
      </div>

      <div>
        <label htmlFor="req-email" className="block text-sm font-medium text-text-secondary mb-1">
          Email
        </label>
        <input
          id="req-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 bg-background-primary border border-border-primary rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-text-secondary mb-1">
          Reason for Access
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={3}
          className="w-full px-3 py-2 bg-background-primary border border-border-primary rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent resize-none"
          placeholder="Tell us about your trading experience and why you'd like access..."
        />
      </div>

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full py-2.5 px-4 bg-surface-secondary hover:bg-surface-hover border border-border-primary text-text-primary font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {status === 'loading' ? 'Submitting...' : 'Request Access'}
      </button>
    </form>
  );
}
