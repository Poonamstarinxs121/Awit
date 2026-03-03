import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SquidJob Node',
  description: 'Local OpenClaw Mission Control',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
