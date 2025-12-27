export default function Footer() {
  return (
    <footer className="border-t border-border-primary bg-background-secondary mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-text-muted text-sm">
            Daghandelaren - Forex Sentiment Dashboard
          </div>
          <div className="flex items-center gap-6 text-sm text-text-muted">
            <span>Data sources: Myfxbook, OANDA, Dukascopy</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
