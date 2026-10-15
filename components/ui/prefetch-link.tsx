'use client';

import Link from 'next/link';
import type { Route } from 'next';
import type { ComponentProps } from 'react';

export type LinkBaseProps<T extends string = string> = Omit<ComponentProps<typeof Link>, 'href' | 'prefetch'> & {
  href: Route<T> | URL;
};

export function PrefetchLink<T extends string>({ href, ...props }: LinkBaseProps<T>) {
  return <Link {...props} href={href as Route} prefetch />;
}
