'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import UserDropdown from './UserDropdown';

interface MegaMenuProps {
  userEmail: string;
  isAdmin: boolean;
  onSearch?: (query: string) => void;
}

interface MenuItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  description?: string;
}

interface MenuSection {
  label: string;
  items?: MenuItem[];
  href?: string;
}

const SentimentItems: MenuItem[] = [
  {
    label: 'Overview',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    description: 'Market signals & overview',
  },
  {
    label: 'Table',
    href: '/sentiment',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 6h18M3 12h18M3 18h18" />
        <path d="M9 3v18M15 3v18" strokeOpacity="0.5" />
      </svg>
    ),
    description: 'Full sentiment data table',
  },
  {
    label: 'History',
    href: '/sentiment/history',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    description: 'Historical sentiment charts',
  },
];

const FundamentalItems: MenuItem[] = [
  {
    label: 'Currency Analysis',
    href: '/fundamental',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v2M12 16v2M6 12h2M16 12h2" />
        <circle cx="12" cy="12" r="4" strokeOpacity="0.5" />
      </svg>
    ),
    description: 'Fundamental currency scores',
  },
  {
    label: 'Pair Biases',
    href: '/fundamental/pairs',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M7 16l-4-4 4-4" />
        <path d="M17 8l4 4-4 4" />
        <path d="M14 4l-4 16" strokeOpacity="0.5" />
      </svg>
    ),
    description: 'Currency pair directional bias',
  },
];

const ChartsItems: MenuItem[] = [
  {
    label: 'Yield Differentials',
    href: '/charts/yield-differentials',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 4 5-9" />
      </svg>
    ),
    description: '2Y bond yield spreads vs USD',
  },
  {
    label: 'Risk Sentiment',
    href: '/charts/risk-sentiment',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    description: 'VIX-based risk regime',
  },
  {
    label: 'Commodities',
    href: '/charts/commodities',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
    description: 'Iron ore, copper, oil, dairy',
  },
];

export default function MegaMenu({ userEmail, isAdmin, onSearch }: MegaMenuProps) {
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setActiveDropdown(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Handle body scroll lock when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleMouseEnter = (menu: string) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setActiveDropdown(menu);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery.trim());
    }
  };

  const isActiveRoute = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    // Exact match for routes to avoid /fundamental matching /fundamental/pairs
    return pathname === href;
  };

  const isParentActive = (items: MenuItem[]) => {
    return items.some(item => isActiveRoute(item.href));
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-background-primary/95 backdrop-blur-md border-b border-border-primary/50">
        <div className="max-w-[1800px] mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              href="/dashboard"
              className="flex items-center gap-3 group"
            >
              <div className="relative w-9 h-9 rounded-lg overflow-hidden ring-1 ring-white/10 group-hover:ring-accent-blue/50 transition-all duration-300">
                <Image
                  src="/logo.png"
                  alt="Daghandelaren"
                  fill
                  className="object-cover"
                />
              </div>
              <span className="hidden sm:block text-lg font-semibold text-text-primary tracking-tight">
                Daghandelaren
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1" ref={menuRef}>
              {/* Sentiment Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => handleMouseEnter('sentiment')}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isParentActive(SentimentItems)
                      ? 'text-accent-blue bg-accent-blue/10'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  Sentiment
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${
                      activeDropdown === 'sentiment' ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Sentiment Dropdown Panel */}
                <div
                  className={`absolute top-full left-0 mt-1 w-64 origin-top-left transition-all duration-200 ${
                    activeDropdown === 'sentiment'
                      ? 'opacity-100 scale-100 translate-y-0'
                      : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                  }`}
                >
                  <div className="bg-surface-primary/95 backdrop-blur-xl rounded-xl border border-border-primary/50 shadow-2xl shadow-black/20 overflow-hidden">
                    <div className="p-2">
                      {SentimentItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                            isActiveRoute(item.href)
                              ? 'bg-accent-blue/10 text-accent-blue'
                              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                          }`}
                        >
                          <span className={`mt-0.5 ${isActiveRoute(item.href) ? 'text-accent-blue' : 'text-text-muted group-hover:text-text-primary'}`}>
                            {item.icon}
                          </span>
                          <div>
                            <div className="text-sm font-medium">{item.label}</div>
                            <div className="text-xs text-text-muted mt-0.5">{item.description}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fundamental Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => handleMouseEnter('fundamental')}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isParentActive(FundamentalItems)
                      ? 'text-accent-blue bg-accent-blue/10'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  Fundamental
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${
                      activeDropdown === 'fundamental' ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Fundamental Dropdown Panel */}
                <div
                  className={`absolute top-full left-0 mt-1 w-64 origin-top-left transition-all duration-200 ${
                    activeDropdown === 'fundamental'
                      ? 'opacity-100 scale-100 translate-y-0'
                      : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                  }`}
                >
                  <div className="bg-surface-primary/95 backdrop-blur-xl rounded-xl border border-border-primary/50 shadow-2xl shadow-black/20 overflow-hidden">
                    <div className="p-2">
                      {FundamentalItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                            isActiveRoute(item.href)
                              ? 'bg-accent-blue/10 text-accent-blue'
                              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                          }`}
                        >
                          <span className={`mt-0.5 ${isActiveRoute(item.href) ? 'text-accent-blue' : 'text-text-muted group-hover:text-text-primary'}`}>
                            {item.icon}
                          </span>
                          <div>
                            <div className="text-sm font-medium">{item.label}</div>
                            <div className="text-xs text-text-muted mt-0.5">{item.description}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => handleMouseEnter('charts')}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isParentActive(ChartsItems)
                      ? 'text-accent-blue bg-accent-blue/10'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  Charts
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${
                      activeDropdown === 'charts' ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Charts Dropdown Panel */}
                <div
                  className={`absolute top-full left-0 mt-1 w-64 origin-top-left transition-all duration-200 ${
                    activeDropdown === 'charts'
                      ? 'opacity-100 scale-100 translate-y-0'
                      : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                  }`}
                >
                  <div className="bg-surface-primary/95 backdrop-blur-xl rounded-xl border border-border-primary/50 shadow-2xl shadow-black/20 overflow-hidden">
                    <div className="p-2">
                      {ChartsItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                            isActiveRoute(item.href)
                              ? 'bg-accent-blue/10 text-accent-blue'
                              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                          }`}
                        >
                          <span className={`mt-0.5 ${isActiveRoute(item.href) ? 'text-accent-blue' : 'text-text-muted group-hover:text-text-primary'}`}>
                            {item.icon}
                          </span>
                          <div>
                            <div className="text-sm font-medium">{item.label}</div>
                            <div className="text-xs text-text-muted mt-0.5">{item.description}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Link */}
              <Link
                href="/chat"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  pathname === '/chat'
                    ? 'text-accent-blue bg-accent-blue/10'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
                Chat
              </Link>

              {/* Admin Link (conditional) */}
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    pathname.startsWith('/admin')
                      ? 'text-accent-blue bg-accent-blue/10'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Admin
                </Link>
              )}
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <form onSubmit={handleSearch} className="hidden md:block relative">
                <div className={`relative transition-all duration-300 ${searchFocused ? 'w-64' : 'w-48'}`}>
                  <input
                    type="text"
                    placeholder="Search pairs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    className="w-full bg-surface-secondary/50 border border-border-primary/50 rounded-lg pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50 focus:bg-surface-secondary transition-all duration-200"
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </form>

              {/* User Dropdown */}
              <UserDropdown email={userEmail} isAdmin={isAdmin} />

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[85vw] bg-surface-primary border-l border-border-primary lg:hidden transform transition-transform duration-300 ease-out ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Mobile Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-border-primary">
            <span className="text-lg font-semibold text-text-primary">Menu</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mobile Search */}
          <div className="p-4 border-b border-border-primary/50">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search pairs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-secondary border border-border-primary rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </form>
          </div>

          {/* Mobile Menu Items */}
          <div className="flex-1 overflow-y-auto py-2">
            {/* Sentiment Accordion */}
            <div className="px-2">
              <button
                onClick={() => setMobileAccordion(mobileAccordion === 'sentiment' ? null : 'sentiment')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isParentActive(SentimentItems)
                    ? 'text-accent-blue bg-accent-blue/10'
                    : 'text-text-primary hover:bg-surface-hover'
                }`}
              >
                <span>Sentiment</span>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${
                    mobileAccordion === 'sentiment' ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  mobileAccordion === 'sentiment' ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className="pl-4 py-1 space-y-1">
                  {SentimentItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        isActiveRoute(item.href)
                          ? 'text-accent-blue bg-accent-blue/5'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Fundamental Accordion */}
            <div className="px-2">
              <button
                onClick={() => setMobileAccordion(mobileAccordion === 'fundamental' ? null : 'fundamental')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isParentActive(FundamentalItems)
                    ? 'text-accent-blue bg-accent-blue/10'
                    : 'text-text-primary hover:bg-surface-hover'
                }`}
              >
                <span>Fundamental</span>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${
                    mobileAccordion === 'fundamental' ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  mobileAccordion === 'fundamental' ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className="pl-4 py-1 space-y-1">
                  {FundamentalItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        isActiveRoute(item.href)
                          ? 'text-accent-blue bg-accent-blue/5'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Charts Accordion */}
            <div className="px-2">
              <button
                onClick={() => setMobileAccordion(mobileAccordion === 'charts' ? null : 'charts')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isParentActive(ChartsItems)
                    ? 'text-accent-blue bg-accent-blue/10'
                    : 'text-text-primary hover:bg-surface-hover'
                }`}
              >
                <span>Charts</span>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${
                    mobileAccordion === 'charts' ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  mobileAccordion === 'charts' ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className="pl-4 py-1 space-y-1">
                  {ChartsItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        isActiveRoute(item.href)
                          ? 'text-accent-blue bg-accent-blue/5'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Chat Link */}
            <div className="px-2">
              <Link
                href="/chat"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  pathname === '/chat'
                    ? 'text-accent-blue bg-accent-blue/10'
                    : 'text-text-primary hover:bg-surface-hover'
                }`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
                Chat
              </Link>
            </div>

            {/* Admin Link (conditional) */}
            {isAdmin && (
              <div className="px-2">
                <Link
                  href="/admin"
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    pathname.startsWith('/admin')
                      ? 'text-accent-blue bg-accent-blue/10'
                      : 'text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Admin
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Footer */}
          <div className="p-4 border-t border-border-primary">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center">
                <span className="text-sm font-semibold text-accent-blue">
                  {userEmail.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {userEmail.split('@')[0]}
                </p>
                <p className="text-xs text-text-muted truncate">{userEmail}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
