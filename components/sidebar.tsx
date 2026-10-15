import { LogOut, Settings, Video } from 'lucide-react';
import { Logo } from '@/components/logo';
import { SidebarShell } from '@/components/sidebar-shell';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { NavLink } from '@/components/ui/nav-link';
import { signOut } from '@/features/user/user-actions';

// Air 3 nav link: 14px ink, hover wash; active = wash + 500 weight + green icon.
const linkClass =
  'flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-foreground no-underline transition-colors hover:bg-hover data-active:bg-hover data-active:font-medium data-active:[&_svg]:text-brand data-pending:opacity-60 group-data-[collapsed]/sidebar:justify-center group-data-[collapsed]/sidebar:px-0';

// Hidden rather than unmounted, so collapsing is a CSS change and this whole tree stays
// on the server. `title` gives the icon-only state a name without a client tooltip.
const labelClass = 'group-data-[collapsed]/sidebar:hidden';

const LINKS = [
  { href: '/', label: 'Library', icon: Video, exact: true },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar() {
  return (
    <SidebarShell>
      <Logo className="mb-6 px-2 group-data-[collapsed]/sidebar:hidden" />
      {/* The toggle sits where the wordmark was, so the rail needs the height back. */}
      <span className="mb-6 hidden h-7 group-data-[collapsed]/sidebar:block" aria-hidden />

      <nav className="flex flex-col gap-1">
        {LINKS.map(({ href, label, icon: Icon, ...rest }) => (
          <NavLink key={href} href={href} className={linkClass} title={label} {...rest}>
            <Icon className="h-4 w-4 shrink-0" />
            <span className={labelClass}>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <div className="group-data-[collapsed]/sidebar:hidden">
          <ThemeToggle />
        </div>
        <form action={signOut}>
          <button type="submit" className={`${linkClass} w-full`} title="Sign out">
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={labelClass}>Sign out</span>
          </button>
        </form>
      </div>
    </SidebarShell>
  );
}
