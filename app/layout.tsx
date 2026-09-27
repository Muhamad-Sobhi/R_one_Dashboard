import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'R/ONE | إدارة الورشة',
  description: 'لوحة إدارة ورشة R/ONE لتصنيع الملابس الشبابية',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" suppressHydrationWarning><body>{children}</body></html>;
}