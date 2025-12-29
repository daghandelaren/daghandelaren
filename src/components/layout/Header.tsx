'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export default function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-50 bg-background-secondary border-b border-border-primary">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent-blue rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <span className="text-xl font-bold text-text-primary">Daghandelaren</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className="text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
            >
              Dashboard
            </Link>
          </nav>

          {/* Auth buttons */}
          <div className="flex items-center gap-4">
            {status === 'loading' ? (
              <div className="w-20 h-8 bg-surface-secondary rounded animate-pulse" />
            ) : session ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-text-secondary hidden sm:block">
                  {session.user?.email}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: 'https://www.daghandelaren.nl' })}
                  className="btn btn-secondary text-sm"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link href="/" className="btn btn-primary text-sm">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
