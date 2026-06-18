import type { Metadata } from 'next';

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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
