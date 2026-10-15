'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

const options = [
  { icon: Sun, label: 'Light', value: 'light' },
  { icon: Moon, label: 'Dark', value: 'dark' },
  { icon: Monitor, label: 'System', value: 'system' },
] as const;

function subscribe() {
  return () => {};
}

/** Air 3 toggle group (`.uw-toggle`): pill segmented control, selected segment fills with ink. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <div className="uw-toggle" role="group" aria-label="Theme" style={{ viewTransitionName: 'theme-toggle' }}>
      {options.map(({ icon: Icon, label, value }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={mounted ? theme === value : false}
          onClick={() => setTheme(value)}
          className="flex! h-7! items-center px-2.5!"
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
