import type { Metadata } from "next";
import {
  Fraunces,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Instrument_Sans,
  Instrument_Serif,
} from "next/font/google";
import {
  PUBLIC_ROBOTS,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  getSiteUrl,
} from "@/lib/seo/site";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

const defaultTitle = `${SITE_NAME} · ${SITE_TAGLINE}`;

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: defaultTitle,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: SITE_NAME,
    title: defaultTitle,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: defaultTitle,
    description: SITE_DESCRIPTION,
  },
  robots: PUBLIC_ROBOTS,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${instrumentSans.variable} ${instrumentSerif.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
