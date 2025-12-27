import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Standard forex currency priority order (higher priority currency is base)
// EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY
const CURRENCY_PRIORITY: Record<string, number> = {
  EUR: 8,
  GBP: 7,
  AUD: 6,
  NZD: 5,
  USD: 4,
  CAD: 3,
  CHF: 2,
  JPY: 1,
};

const CURRENCIES = Object.keys(CURRENCY_PRIORITY);

// Generate all 28 forex pairs using standard market conventions
function generateForexPairs(): Array<{ symbol: string; base: string; quote: string }> {
  const pairs: Array<{ symbol: string; base: string; quote: string }> = [];

  for (let i = 0; i < CURRENCIES.length; i++) {
    for (let j = i + 1; j < CURRENCIES.length; j++) {
      const curr1 = CURRENCIES[i];
      const curr2 = CURRENCIES[j];
      // Higher priority currency becomes base
      const base = CURRENCY_PRIORITY[curr1] > CURRENCY_PRIORITY[curr2] ? curr1 : curr2;
      const quote = base === curr1 ? curr2 : curr1;
      pairs.push({
        symbol: `${base}/${quote}`,
        base,
        quote,
      });
    }
  }

  return pairs;
}

// Common commodities that sentiment sources might provide
const COMMODITIES = [
  { symbol: 'XAU/USD', base: 'XAU', quote: 'USD' }, // Gold
  { symbol: 'XAG/USD', base: 'XAG', quote: 'USD' }, // Silver
  { symbol: 'WTI/USD', base: 'WTI', quote: 'USD' }, // Oil (WTI)
  { symbol: 'BRENT/USD', base: 'BRENT', quote: 'USD' }, // Oil (Brent)
];

// Common indices
const INDICES = [
  { symbol: 'SPX500', base: 'SPX500', quote: 'USD' }, // S&P 500
  { symbol: 'NAS100', base: 'NAS100', quote: 'USD' }, // Nasdaq 100
  { symbol: 'US30', base: 'US30', quote: 'USD' }, // Dow Jones
  { symbol: 'DE30', base: 'DE30', quote: 'EUR' }, // DAX
];

// Crypto
const CRYPTO = [
  { symbol: 'BTC/USD', base: 'BTC', quote: 'USD' }, // Bitcoin
  { symbol: 'ETH/USD', base: 'ETH', quote: 'USD' }, // Ethereum
];

// Sentiment data sources
const SOURCES = [
  {
    name: 'myfxbook',
    baseUrl: 'https://www.myfxbook.com/api',
  },
  {
    name: 'oanda',
    baseUrl: 'https://proptrader.oanda.com/en/lab-education/tools/sentiment/',
  },
  {
    name: 'dukascopy',
    baseUrl: 'https://www.dukascopy.com/swiss/english/marketwatch/sentiment/',
  },
  {
    name: 'forexfactory',
    baseUrl: 'https://www.forexfactory.com/trades',
  },
  {
    name: 'fxblue',
    baseUrl: 'https://www.fxblue.com/market-data/tools/sentiment',
  },
];

async function main() {
  console.log('Seeding database...');

  // Create sentiment sources
  console.log('Creating sentiment sources...');
  for (const source of SOURCES) {
    await prisma.sentimentSource.upsert({
      where: { name: source.name },
      update: { baseUrl: source.baseUrl },
      create: source,
    });
  }

  // Create forex pairs
  console.log('Creating forex instruments...');
  const forexPairs = generateForexPairs();
  for (const pair of forexPairs) {
    await prisma.instrument.upsert({
      where: { symbol: pair.symbol },
      update: {},
      create: {
        symbol: pair.symbol,
        base: pair.base,
        quote: pair.quote,
        assetClass: 'forex',
      },
    });
  }

  // Create commodities
  console.log('Creating commodity instruments...');
  for (const commodity of COMMODITIES) {
    await prisma.instrument.upsert({
      where: { symbol: commodity.symbol },
      update: {},
      create: {
        symbol: commodity.symbol,
        base: commodity.base,
        quote: commodity.quote,
        assetClass: 'commodity',
      },
    });
  }

  // Create indices
  console.log('Creating index instruments...');
  for (const index of INDICES) {
    await prisma.instrument.upsert({
      where: { symbol: index.symbol },
      update: {},
      create: {
        symbol: index.symbol,
        base: index.base,
        quote: index.quote,
        assetClass: 'index',
      },
    });
  }

  // Create crypto
  console.log('Creating crypto instruments...');
  for (const crypto of CRYPTO) {
    await prisma.instrument.upsert({
      where: { symbol: crypto.symbol },
      update: {},
      create: {
        symbol: crypto.symbol,
        base: crypto.base,
        quote: crypto.quote,
        assetClass: 'crypto',
      },
    });
  }

  // Create admin user if doesn't exist
  console.log('Checking admin user...');
  const adminEmail = 'ieyuhn@gmail.com';
  const adminPassword = 'CHANGE_ME_NOW_123!';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Admin',
        role: 'ADMIN',
      },
    });
    console.log(`Created admin user: ${adminEmail}`);
    console.log('⚠️  IMPORTANT: Change the password immediately after first login!');
  } else {
    console.log('Admin user already exists');
  }

  // Log summary
  const instrumentCount = await prisma.instrument.count();
  const sourceCount = await prisma.sentimentSource.count();
  const userCount = await prisma.user.count();

  console.log(`\nSeeding complete!`);
  console.log(`- ${sourceCount} sentiment sources`);
  console.log(`- ${instrumentCount} instruments (${forexPairs.length} forex, ${COMMODITIES.length} commodities, ${INDICES.length} indices, ${CRYPTO.length} crypto)`);
  console.log(`- ${userCount} users`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
