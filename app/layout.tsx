import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'KeyLo | Underwriting OS', description: 'Vehicle subscription underwriting for Uganda' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
