import type { Metadata } from 'next';

import { MUSEO_CDN_URL, museoFontFaceCss } from '@/lib/brand-font';

export const metadata: Metadata = {
  title: 'SSE DCO Layout Editor',
  description: 'Layout and sample-value editor for SSE DCO GWD creatives',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" href={MUSEO_CDN_URL} as="font" type="font/otf" crossOrigin="anonymous" />
        <style dangerouslySetInnerHTML={{ __html: museoFontFaceCss() }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
