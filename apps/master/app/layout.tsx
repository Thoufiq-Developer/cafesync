import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ALL_FONT_VARIABLE_CLASSES } from '@/lib/theme/fonts';
import { ReactQueryProvider } from '@/lib/query-provider';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'CafeSync Master',
  description: 'CafeSync Master Administration Platform',
  icons: {
    icon: '/brand/cafesync-favicon-64.png',
    shortcut: '/brand/cafesync-favicon-64.png',
    apple: '/brand/cafesync-icon-192.png',
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#28150E',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full dark ${ALL_FONT_VARIABLE_CLASSES}`} style={{ colorScheme: 'dark', backgroundColor: '#28150E' }}>
      <body className="min-h-full flex flex-col font-sans bg-[#28150E] text-[#F7E5BC] antialiased">
        <ReactQueryProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ReactQueryProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
