import type { Metadata } from "next";
import { Geist, Geist_Mono, Bruno_Ace } from "next/font/google";
import "./globals.css";
import { Providers } from "./components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const brunoAce = Bruno_Ace({
  variable: "--font-bruno-ace",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Nova Wallet - AI-Powered Crypto Wallet",
  description: "Manage your crypto with natural language commands using Nova AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${brunoAce.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
