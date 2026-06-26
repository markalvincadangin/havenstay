import { DM_Sans, DM_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import AppFrame from '@/components/layout/AppFrame';
import { AuthProvider } from '@/context/AuthContext';

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta-sans',
  subsets: ['latin'],
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
});

const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
});

export const metadata = {
  title: 'HavenStay',
  description: 'Boarding House Management System',
  icons: {
    icon: '/brand/favicon.svg',
  },
};

import { SWRProvider } from '@/context/SWRConfig';
import { ToastProvider } from '@/context/ToastContext';

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full" suppressHydrationWarning>
        <SWRProvider>
          <AuthProvider>
            <ToastProvider>
              <AppFrame>{children}</AppFrame>
            </ToastProvider>
          </AuthProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
