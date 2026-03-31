'use client';

import { useState } from 'react';

const STORAGE_KEYS = [
  { key: 'sideboard_campaigns', table: 'campaigns' },
  { key: 'sideboard_world_meta', table: 'world_meta' },
  { key: 'sideboard_lore', table: 'lore_entries' },
  { key: 'sideboard_plots', table: 'plot_arcs' },
  { key: 'sideboard_npcs', table: 'npcs' },
  { key: 'sideboard_locations', table: 'locations' },
  { key: 'sideboard_factions', table: 'factions' },
  { key: 'sideboard_items', table: 'items' },
  { key: 'sideboard_sessions', table: 'sessions' },
  { key: 'sideboard_scenes', table: 'scenes' },
  { key: 'sideboard_encounters', table: 'encounters' },
  { key: 'sideboard_stat_blocks', table: 'stat_blocks' },
  { key: 'sideboard_session_logs', table: 'session_logs' },
  { key: 'sideboard_player_characters', table: 'player_characters' },
  { key: 'sideboard_builder_messages', table: 'builder_messages' },
];

export default function ExportPage() {
  const [status, setStatus] = useState('');

  function handleExport() {
    const data: Record<string, unknown[]> = {};
    let totalRows = 0;

    for (const { key, table } of STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      const rows = raw ? JSON.parse(raw) : [];
      data[table] = rows;
      totalRows += rows.length;
    }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'local-data-export.json';
    a.click();
    URL.revokeObjectURL(url);

    const summary = STORAGE_KEYS
      .map(({ table }) => `${table}: ${data[table].length}`)
      .filter((s) => !s.endsWith(': 0'))
      .join(', ');

    setStatus(`Exported ${totalRows} total rows. ${summary}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 parchment-bg">
      <h1 className="font-logo text-3xl mb-2 text-accent">Export Local Data</h1>
      <p className="text-muted mb-6 italic max-w-md text-center">
        This exports all campaign data from your browser&apos;s localStorage into a JSON file for migration to the hosted database.
      </p>
      <button
        onClick={handleExport}
        className="btn-primary px-6 py-3 rounded text-sm"
      >
        Download Export
      </button>
      {status && (
        <p className="mt-4 text-sm text-accent max-w-md text-center">{status}</p>
      )}
    </div>
  );
}
