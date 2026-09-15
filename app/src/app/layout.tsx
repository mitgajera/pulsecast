import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import "./globals.css";
import { PulseCastAuthProvider } from "@/features/auth/auth-context";

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  description:
    "Predict Bitcoin's exact minute-close price privately on MagicBlock.",
  title: {
    default: "PulseCast",
    template: "%s · PulseCast",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <PulseCastAuthProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}>{children}</PulseCastAuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
