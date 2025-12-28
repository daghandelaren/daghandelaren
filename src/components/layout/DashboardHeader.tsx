'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import SearchBox from '@/components/ui/SearchBox';
import UserDropdown from '@/components/layout/UserDropdown';

type ViewType = 'overview' | 'table' | 'history';

interface DashboardHeaderProps {
  onSearch?: (query: string) => void;
  view?: ViewType;
  onViewChange?: (view: ViewType) => void;
}

export default function DashboardHeader({ onSearch, view = 'overview', onViewChange }: DashboardHeaderProps) {
  const { data: session } = useSession();
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const viewDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const isAdmin = session?.user?.role === 'ADMIN';

  const handleSearch = (query: string) => {
    if (onSearch) {
      onSearch(query);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-background-secondary/95 backdrop-blur-sm border-b border-border-primary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center h-16 gap-4 sm:gap-8">
          {/* Logo + Brand */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 shrink-0 group"
          >
            <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-surface-secondary flex items-center justify-center ring-1 ring-border-primary/50 group-hover:ring-accent-blue/50 transition-all duration-200">
              <Image
                src="/logo.png"
                alt="Daghandelaren"
                width={32}
                height={32}
                className="object-contain"
                priority
              />
            </div>
            <span className="text-lg font-bold text-text-primary hidden sm:block tracking-tight">
              Daghandelaren
            </span>
          </Link>

          {/* Mobile View Dropdown */}
          {onViewChange && (
            <div className="relative sm:hidden" ref={viewDropdownRef}>
              <button
                onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-surface-secondary/80 rounded-lg border border-border-primary/30 text-sm font-medium text-text-primary"
              >
                <span className="capitalize">{view}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${isViewDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isViewDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-background-secondary border border-border-primary rounded-lg shadow-lg overflow-hidden z-50 min-w-[120px]">
                  {(['overview', 'table', 'history'] as ViewType[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        onViewChange(tab);
                        setIsViewDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-sm font-medium text-left capitalize transition-colors ${
                        view === tab
                          ? 'bg-accent-blue/20 text-accent-blue'
                          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* View Tabs - Desktop Segmented Control */}
          {onViewChange && (
            <div className="hidden sm:flex bg-surface-secondary/80 rounded-lg p-0.5 border border-border-primary/30">
              {(['overview', 'table', 'history'] as ViewType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => onViewChange(tab)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 capitalize ${
                    view === tab
                      ? 'bg-background-primary text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1 hidden md:block" />

          {/* Global Search */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:flex-none">
            <SearchBox
              variant="compact"
              placeholder="Search instruments..."
              onSearch={handleSearch}
            />
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors duration-150"
            >
              Dashboard
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="px-3 py-1.5 text-sm font-medium text-accent-blue hover:text-accent-blue/80 hover:bg-accent-blue/10 rounded-lg transition-colors duration-150"
              >
                Admin
              </Link>
            )}
          </nav>

          {/* User Dropdown */}
          {session?.user?.email && (
            <UserDropdown
              email={session.user.email}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>
    </header>
  );
}
