'use client';

import { useSession } from 'next-auth/react';
import MegaMenu from '@/components/layout/MegaMenu';
import CommoditiesChart from '@/components/charts/CommoditiesChart';

export default function CommoditiesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-background-primary">
      <MegaMenu userEmail={session?.user?.email || ''} isAdmin={isAdmin} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <CommoditiesChart />
      </main>
    </div>
  );
}
