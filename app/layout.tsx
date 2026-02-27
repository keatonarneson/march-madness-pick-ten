import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    metadataBase: new URL(
        process.env.NEXT_PUBLIC_SITE_URL ||
            'https://march-madness-pick-ten.vercel.app',
    ),
    title: {
        default: 'March Madness Pick-10 Pool',
        template: '%s | Pick-10 Pool',
    },
    description:
        'Pick 10 teams across ranking tiers and compete for the prize pool.',
    openGraph: {
        title: 'March Madness Pick-10 Pool',
        description:
            'Pick 10 teams across ranking tiers and compete for the prize pool.',
        url: 'https://march-madness-pick-ten.vercel.app',
        siteName: 'Pick-10 Pool',
        type: 'website',
        images: [
            {
                url: '/preview.png',
                width: 1200,
                height: 630,
                alt: 'March Madness Pick-10 Pool',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'March Madness Pick-10 Pool',
        description:
            'Pick 10 teams across ranking tiers and compete for the prize pool.',
        images: ['/preview.png'],
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                {children}
            </body>
        </html>
    );
}
