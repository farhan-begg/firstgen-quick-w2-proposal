import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FirstGen Proposal",
    template: "%s | FirstGen Proposal",
  },
  description:
    "Secure tax reduction proposals powered by First Gen Industries. View your personalized W-2 tax savings analysis.",
  keywords: ["tax reduction", "W-2", "employer savings", "employee reduction", "First Gen Industries"],
  authors: [{ name: "First Gen Industries LTD" }],
  openGraph: {
    title: "FirstGen Proposal",
    description: "View your personalized W-2 tax savings analysis.",
    type: "website",
    siteName: "FirstGen Proposal",
  },
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
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
