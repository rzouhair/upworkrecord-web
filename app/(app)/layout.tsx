import { MobileTabBar } from '@/components/mobile-nav';
import { Sidebar } from '@/components/sidebar';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-0 w-full flex-1">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto pb-24 sm:pb-0">{children}</main>
      <MobileTabBar />
    </div>
  );
}
