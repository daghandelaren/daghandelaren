/**
 * Script to remove ForexCom from the database
 * Removes the sentiment source and associated snapshots
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeForexcom() {
  console.log('Starting ForexCom removal...\n');

  try {
    // Find the forexcom source
    const forexcomSource = await prisma.sentimentSource.findFirst({
      where: {
        name: {
          contains: 'forexcom',
          mode: 'insensitive',
        },
      },
    });

    if (!forexcomSource) {
      console.log('ForexCom source not found in database.');

      // List all sources for reference
      const sources = await prisma.sentimentSource.findMany({
        select: { id: true, name: true, isActive: true },
      });
      console.log('\nExisting sources:');
      sources.forEach((s) => console.log(`  - ${s.name} (active: ${s.isActive})`));
      return;
    }

    console.log(`Found ForexCom source: ${forexcomSource.name} (ID: ${forexcomSource.id})`);

    // Count snapshots to delete
    const snapshotCount = await prisma.sentimentSnapshot.count({
      where: { sourceId: forexcomSource.id },
    });
    console.log(`Found ${snapshotCount} snapshots to delete`);

    // Delete snapshots first (due to foreign key constraint)
    if (snapshotCount > 0) {
      console.log('Deleting snapshots...');
      const deleted = await prisma.sentimentSnapshot.deleteMany({
        where: { sourceId: forexcomSource.id },
      });
      console.log(`Deleted ${deleted.count} snapshots`);
    }

    // Delete the source
    console.log('Deleting ForexCom source...');
    await prisma.sentimentSource.delete({
      where: { id: forexcomSource.id },
    });
    console.log('ForexCom source deleted successfully');

    // List remaining sources
    const remainingSources = await prisma.sentimentSource.findMany({
      select: { name: true, isActive: true },
    });
    console.log('\nRemaining sources:');
    remainingSources.forEach((s) => console.log(`  - ${s.name} (active: ${s.isActive})`));

  } catch (error) {
    console.error('Error removing ForexCom:', error);
  } finally {
    await prisma.$disconnect();
  }
}

removeForexcom();
