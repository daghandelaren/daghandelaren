import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const data = await prisma.sentimentSnapshot.findMany({
    where: {
      source: { name: 'forexfactory' }
    },
    include: {
      instrument: true,
      source: true
    },
    orderBy: { timestamp: 'desc' },
    take: 8
  });

  console.log('ForexFactory Instruments (latest 8):');
  console.log('');
  data.forEach(d => {
    console.log(`  ${d.instrument.symbol.padEnd(10)} Long ${d.longPercent.toFixed(1).padStart(5)}% | Short ${d.shortPercent.toFixed(1).padStart(5)}%`);
  });
}

main().finally(() => prisma.$disconnect());
