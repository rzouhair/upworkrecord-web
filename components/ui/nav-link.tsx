'use client';

import { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { PrefetchLink, type LinkBaseProps } from '@/components/ui/prefetch-link';

type Props<T extends string = string> = LinkBaseProps<T> & { exact?: boolean };

function checkActive(pathname: string, href: string, exact?: boolean) {
  if (exact || href === '/') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLink<T extends string>(props: Props<T>) {
  return (
    <Suspense fallback={<NavLinkShell {...props} isActive={false} />}>
      <NavLinkInner {...props} />
    </Suspense>
  );
}

function NavLinkInner<T extends string>(props: Props<T>) {
  const pathname = usePathname();
  return <NavLinkShell {...props} isActive={checkActive(pathname, props.href.toString(), props.exact)} />;
}

function NavLinkShell<T extends string>({
  href,
  exact: _exact,
  isActive,
  children,
  ...rest
}: Props<T> & { isActive: boolean }) {
  const { pending } = useLinkStatus();

  return (
    <PrefetchLink
      href={href}
      aria-current={isActive ? 'page' : undefined}
      data-active={isActive ? '' : undefined}
      data-pending={pending ? '' : undefined}
      suppressHydrationWarning
      {...rest}
    >
      {children}
    </PrefetchLink>
  );
}
