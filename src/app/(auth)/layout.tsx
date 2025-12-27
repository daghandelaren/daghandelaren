import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      {/* Simple header with logo */}
      <header className="border-b border-border-primary bg-background-secondary">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/" className="text-xl font-bold text-text-primary hover:text-accent-blue transition-colors">
            Daghandelaren
          </Link>
        </div>
      </header>

      {/* Centered content */}
      <main className="flex-1 flex items-center justify-center p-4">{children}</main>

      {/* Simple footer */}
      <footer className="border-t border-border-primary bg-background-secondary">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-text-muted text-sm">
          Daghandelaren - Forex Sentiment Dashboard
        </div>
      </footer>
    </div>
  );
}
