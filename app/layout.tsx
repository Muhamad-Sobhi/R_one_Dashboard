import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'R/ONE | لوحة الإدارة',
  description: 'لوحة إدارة متجر R/ONE: المنتجات والطلبات والعملاء ووسائل التواصل.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" suppressHydrationWarning><body>{children}</body></html>;
}