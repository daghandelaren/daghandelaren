# Daghandelaren

A forex sentiment dashboard in CoinMarketCap style with dark theme, dense data tables, and real-time sentiment data from multiple sources.

## Features

- **User Authentication**: Sign up, sign in, sign out with email/password
- **Sentiment Dashboard**: FX sentiment for 28 cross-referenced pairs (AUD, CAD, CHF, EUR, GBP, JPY, NZD, USD)
- **Multiple Data Sources**: Myfxbook API, OANDA sentiment, Dukascopy sentiment
- **Two View Modes**: Table view and Matrix view
- **CoinMarketCap-style UI**: Dark theme, sortable tables, green/red sentiment colors

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite (dev) / PostgreSQL (prod) with Prisma ORM
- **Auth**: NextAuth.js with Credentials provider
- **Scraping**: Puppeteer for OANDA/Dukascopy, Myfxbook public API

## Prerequisites

- Node.js 18+
- npm or yarn
- Docker (optional, for PostgreSQL)

## Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repo-url>
   cd daghandelaren
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Set up the database:**
   ```bash
   # Generate Prisma client
   npm run db:generate

   # Push schema to database
   npm run db:push

   # Seed initial data (instruments, sources)
   npm run db:seed
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open the app:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Using PostgreSQL (Optional)

1. **Start the PostgreSQL container:**
   ```bash
   docker-compose up -d
   ```

2. **Update .env:**
   ```
   DATABASE_URL="postgresql://daghandelaren:daghandelaren@localhost:5432/daghandelaren"
   ```

3. **Run migrations:**
   ```bash
   npm run db:push
   npm run db:seed
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Yes |
| `NEXTAUTH_SECRET` | Secret for NextAuth sessions | Yes |
| `NEXTAUTH_URL` | App URL (http://localhost:3000 for dev) | Yes |
| `MYFXBOOK_EMAIL` | Myfxbook account email | For Myfxbook data |
| `MYFXBOOK_PASSWORD` | Myfxbook account password | For Myfxbook data |
| `SCRAPE_INTERVAL_MS` | Scrape interval in ms (default: 300000) | No |
| `SCRAPE_TIMEOUT_MS` | Scrape timeout in ms (default: 30000) | No |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed database with initial data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run scrape` | Manually trigger scrape |

## Data Sources

### Myfxbook
- Uses public API at https://www.myfxbook.com/api
- Requires account credentials
- Provides community outlook sentiment data

### OANDA
- Scrapes https://proptrader.oanda.com/en/lab-education/tools/sentiment/
- Uses Puppeteer for JavaScript-rendered content
- Provides position ratio data

### Dukascopy
- Scrapes https://www.dukascopy.com/swiss/english/marketwatch/sentiment/
- Uses Puppeteer for data extraction
- Provides SWFX sentiment index

## Scheduled Scraping

Call the cron endpoint to trigger scraping:
```bash
# Manual trigger
curl http://localhost:3000/api/cron

# Set up external cron (e.g., every hour)
0 * * * * curl http://localhost:3000/api/cron
```

## License

MIT
