'use client';

import { use } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import LiveShelf from '@/components/layout/LiveShelf';
import SearchModal from '@/components/shared/SearchModal';

export default function CampaignLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar campaignId={id} />
      <main className="flex-1 overflow-y-auto p-6 parchment-bg page-shadow">{children}</main>
      <LiveShelf />
      <SearchModal campaignId={id} />
    </div>
  );
}
