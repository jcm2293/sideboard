'use client';

import { use } from 'react';
import BuilderChat from '@/components/builder/BuilderChat';

export default function BuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="h-[calc(100vh-3rem)] -m-6 flex flex-col">
      <div className="px-6 py-3 border-b border-border bg-surface/80">
        <h1 className="font-display text-lg text-accent">Campaign Builder</h1>
        <p className="text-xs text-muted">Build your world through guided conversation</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <BuilderChat campaignId={id} />
      </div>
    </div>
  );
}
