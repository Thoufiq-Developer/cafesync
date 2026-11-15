import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ALL_FONT_VARIABLE_CLASSES } from '@/lib/theme/fonts';

export const metadata: Metadata = {
  title: 'CafeLedger | Platform Master Admin',
  description: 'Enterprise Cafe Accounting & Multi-Outlet Management Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full ${ALL_FONT_VARIABLE_CLASSES}`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}

