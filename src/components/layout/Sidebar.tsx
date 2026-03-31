'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const sections = [
  { label: 'Overview', href: '', icon: '\u2694' },
  { label: 'Builder', href: '/builder', icon: '\u2728' },
  { label: 'Lore', href: '/lore', icon: '\uD83D\uDCDC' },
  { label: 'Plot Arcs', href: '/plots', icon: '\uD83D\uDDFA' },
  { label: 'NPCs', href: '/npcs', icon: '\uD83D\uDC64' },
  { label: 'Locations', href: '/locations', icon: '\uD83C\uDFF0' },
  { label: 'Factions', href: '/factions', icon: '\u2691' },
  { label: 'Items', href: '/items', icon: '\uD83D\uDDE1' },
  { label: 'Spells', href: '/spells', icon: '\uD83D\uDD2E' },
  { label: 'Sessions', href: '/sessions', icon: '\uD83D\uDCC5' },
  { label: 'Bestiary', href: '/bestiary', icon: '\uD83D\uDC09' },
  { label: 'Players', href: '/players', icon: '\uD83C\uDFAD' },
  { label: 'Quick Ref', href: '/reference', icon: '\uD83D\uDCD6' },
];

export default function Sidebar({ campaignId }: { campaignId: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const base = `/campaign/${campaignId}`;

  return (
    <aside
      className={`${
        collapsed ? 'w-14' : 'w-56'
      } sidebar-wood border-r border-sidebar-border flex flex-col transition-all duration-200 shrink-0`}
    >
      <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
        {!collapsed && (
          <Link href="/" className="block flex-1 min-w-0">
            <div className="bg-amber-50/90 rounded-md px-2 py-1.5">
              <Image
                src="/logo.png"
                alt="Sideboard"
                width={1314}
                height={318}
                className="w-full h-auto"
              />
            </div>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`text-sidebar-text hover:text-gold text-lg ${collapsed ? '' : 'ml-2'} shrink-0`}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {/* Thin gold decorative line */}
      <div className="h-px mx-3 bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <nav className="flex-1 py-2 overflow-y-auto sidebar-scroll">
        {sections.map((s) => {
          const href = `${base}${s.href}`;
          const isActive =
            s.href === ''
              ? pathname === base
              : pathname.startsWith(href);
          return (
            <Link
              key={s.href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 font-heading text-sm transition-all duration-150 ${
                isActive
                  ? 'sidebar-nav-active text-gold text-[0.9rem]'
                  : 'text-sidebar-text hover:text-gold hover:bg-sidebar-bg-light'
              }`}
              title={s.label}
            >
              <span className="text-base shrink-0">{s.icon}</span>
              {!collapsed && <span className="truncate">{s.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
