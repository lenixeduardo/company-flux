import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Flux Financeiro',
    template: '%s | Flux Financeiro',
  },
  description:
    'Plataforma completa de gestão financeira para empresas. Controle fluxo de caixa, notas fiscais, impostos e muito mais.',
  keywords: ['finanças', 'gestão financeira', 'fluxo de caixa', 'notas fiscais', 'impostos'],
  authors: [{ name: 'Flux Financeiro' }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: 'Flux Financeiro',
    description:
      'Plataforma completa de gestão financeira para empresas.',
    siteName: 'Flux Financeiro',
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Flux Financeiro',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flux Financeiro',
    description: 'Plataforma completa de gestão financeira para empresas.',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
