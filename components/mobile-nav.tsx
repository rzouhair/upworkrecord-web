import { Settings, Video } from 'lucide-react';
import { NavLink } from '@/components/ui/nav-link';

const linkClass =
  'flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium text-muted-foreground no-underline data-active:text-foreground data-active:[&_svg]:text-brand data-pending:opacity-60';

export function MobileTabBar() {
  return (
    <nav
      aria-label="Primary"
      style={{ viewTransitionName: 'mobile-nav' }}
      className="border-divider fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <NavLink href="/" exact className={linkClass}>
        <Video className="h-5 w-5" />
        Library
      </NavLink>
      <NavLink href="/settings" className={linkClass}>
        <Settings className="h-5 w-5" />
        Settings
      </NavLink>
    </nav>
  );
}
