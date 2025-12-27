'use client';

import { useState, useEffect } from 'react';

interface AccessRequest {
  id: string;
  name: string;
  email: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export default function AccessRequests() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    try {
      const response = await fetch('/api/admin/access-requests');
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    try {
      const response = await fetch('/api/admin/access-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      if (response.ok) {
        setRequests(requests.map(r => r.id === id ? { ...r, status } : r));
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  async function deleteRequest(id: string) {
    if (!confirm('Are you sure you want to delete this request?')) return;

    try {
      const response = await fetch(`/api/admin/access-requests?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setRequests(requests.filter(r => r.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete request:', error);
    }
  }

  const filteredRequests = filter === 'ALL'
    ? requests
    : requests.filter(r => r.status === filter);

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  if (loading) {
    return (
      <div className="bg-surface-primary border border-border-primary rounded-lg p-8">
        <div className="text-text-secondary text-center">Loading access requests...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">Access Requests</h2>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 bg-sentiment-neutral/20 text-sentiment-neutral text-xs font-medium rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="px-3 py-1.5 bg-surface-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
        >
          <option value="ALL">All requests</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Requests list */}
      <div className="bg-surface-primary border border-border-primary rounded-lg overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            No access requests {filter !== 'ALL' ? `with status "${filter.toLowerCase()}"` : 'yet'}
          </div>
        ) : (
          <div className="divide-y divide-border-primary">
            {filteredRequests.map((request) => (
              <div key={request.id} className="p-4 hover:bg-surface-hover transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-text-primary">{request.name}</span>
                      <StatusBadge status={request.status} />
                    </div>
                    <a
                      href={`mailto:${request.email}`}
                      className="text-sm text-accent-cyan hover:underline"
                    >
                      {request.email}
                    </a>
                    <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap">
                      {request.reason}
                    </p>
                    <p className="text-xs text-text-muted mt-2">
                      {new Date(request.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {request.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => updateStatus(request.id, 'APPROVED')}
                          className="px-3 py-1.5 bg-sentiment-bullish/20 text-sentiment-bullish text-sm font-medium rounded hover:bg-sentiment-bullish/30 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(request.id, 'REJECTED')}
                          className="px-3 py-1.5 bg-sentiment-bearish/20 text-sentiment-bearish text-sm font-medium rounded hover:bg-sentiment-bearish/30 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteRequest(request.id)}
                      className="p-1.5 text-text-muted hover:text-sentiment-bearish hover:bg-sentiment-bearish/10 rounded transition-colors"
                      title="Delete request"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'PENDING' | 'APPROVED' | 'REJECTED' }) {
  const styles = {
    PENDING: 'bg-sentiment-neutral/20 text-sentiment-neutral',
    APPROVED: 'bg-sentiment-bullish/20 text-sentiment-bullish',
    REJECTED: 'bg-sentiment-bearish/20 text-sentiment-bearish',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[status]}`}>
      {status.toLowerCase()}
    </span>
  );
}
