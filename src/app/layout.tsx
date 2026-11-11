import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Video2MP3 - Professional Audio Extraction & DSP Suite',
  description: 'Download online video audio, convert to high-grade MP3, master with Web Audio DSP & export studio-quality sound.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
