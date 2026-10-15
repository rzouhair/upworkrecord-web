import localFont from 'next/font/local';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme/theme-provider';
import type { Metadata, Viewport } from 'next';
import './globals.css';

// Air 3 ships PP Neue Montreal (licensed); the design system's free stand-in is Hanken Grotesk,
// variable 100–900 so the 370/450/550 weights resolve.
const hanken = localFont({
  src: [
    { path: './fonts/hanken-grotesk.woff2', style: 'normal', weight: '100 900' },
    { path: './fonts/hanken-grotesk-italic.woff2', style: 'italic', weight: '100 900' },
  ],
  variable: '--font-hanken',
  display: 'swap',
});

export const viewport: Viewport = {
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  description: 'Record, share and pitch with video.',
  title: {
    default: 'UpworkRecord',
    template: '%s · UpworkRecord',
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={hanken.variable} suppressHydrationWarning>
      <body className="flex h-[100dvh] flex-col">
        <ThemeProvider>
          {children}
          {/* Air 3 toast: ink plate, white text, green icon */}
          <Toaster
            toastOptions={{
              unstyled: true,
              style: { viewTransitionName: 'none' },
              classNames: {
                toast: 'uw-toast w-full',
                icon: 'text-[var(--up-green)] in-data-[type=error]:text-[var(--red-light)] in-data-[type=warning]:text-[var(--yellow)]',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
