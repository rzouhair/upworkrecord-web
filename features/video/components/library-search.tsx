'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { Route } from 'next';

export function LibrarySearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    // Air 3 small search: pill, 1px control border, ink focus ring.
    <label className="uw-search uw-search--sm mb-0 h-10! w-full font-normal sm:w-72">
      <span className="sr-only">Search videos</span>
      <Search aria-hidden />
      <input
        type="search"
        placeholder="Search videos"
        defaultValue={params.get('q') ?? ''}
        data-pending={pending ? '' : undefined}
        className="data-pending:opacity-70"
        onChange={e => {
          const q = e.target.value;
          startTransition(() => router.replace((q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname) as Route));
        }}
      />
    </label>
  );
}
