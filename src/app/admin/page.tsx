'use client';

import { useState } from 'react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import UserManagement from '@/components/admin/UserManagement';
import ScraperControls from '@/components/admin/ScraperControls';
import AccessRequests from '@/components/admin/AccessRequests';

type Tab = 'users' | 'requests' | 'scrapers';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('users');

  return (
    <div className="min-h-screen bg-background-primary">
      <DashboardHeader />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Admin Panel</h1>
          <p className="text-text-secondary text-sm mt-1">
            Manage users and system settings
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex items-center gap-1 bg-surface-secondary rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'bg-accent-blue text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'requests'
                  ? 'bg-accent-blue text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              Access Requests
            </button>
            <button
              onClick={() => setActiveTab('scrapers')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'scrapers'
                  ? 'bg-accent-blue text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              Data Controls
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'requests' && <AccessRequests />}
        {activeTab === 'scrapers' && <ScraperControls />}
      </main>
    </div>
  );
}
