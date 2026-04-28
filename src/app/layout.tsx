import type { Metadata } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { APP_NAME, APP_ORG } from '@/lib/constants';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} · SYSDE`,
    template: `%s · ${APP_NAME}`,
  },
  description: `${APP_NAME} — CRM interno de ${APP_ORG}`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${montserrat.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-sysde-bg font-sans text-sysde-gray antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
