'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'sidebar-collapsed';

// Owns the collapsed state so `Sidebar` itself can stay a server component: the state
// reaches the content as a data attribute, and the labels hide through
// `group-data-[collapsed]/sidebar:*` rather than by re-rendering on the client.
export function SidebarShell({ children }: { children: React.ReactNode }) {
  // Read during the first render rather than in an effect, so a collapsed sidebar does
  // not flash open on every navigation. The server has no localStorage and renders
  // expanded, so the <aside> is suppressHydrationWarning — the mismatch is confined to
  // its own attributes (the labels hide in CSS, so the DOM below is identical).
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      // No window on the server; private mode or blocked storage on the client.
      return false;
    }
  });

  function toggle() {
    setCollapsed(next => {
      const value = !next;
      try {
        localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
      } catch {
        // Nothing to do — the choice just will not survive a reload.
      }
      return value;
    });
  }

  return (
    <aside
      suppressHydrationWarning
      data-collapsed={collapsed ? '' : undefined}
      style={{ viewTransitionName: 'sidebar' }}
      className={cn(
        'group/sidebar border-divider relative hidden shrink-0',
        'flex-col border-r px-3 py-4 transition-[width] duration-200 ease-out sm:flex',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {children}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'text-muted-foreground hover:bg-hover hover:text-foreground',
          'absolute top-4 right-2 rounded-md p-1.5 transition-colors',
          // Centred over the rail when collapsed, where there is no room beside the mark.
          collapsed && 'right-1/2 translate-x-1/2',
        )}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>
    </aside>
  );
}
