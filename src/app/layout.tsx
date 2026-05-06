import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BagsRadar — AI On-Chain Alpha Radar for Bags.fm Creator Tokens",
  description: "AI-powered alpha intelligence for Bags.fm. Holder concentration, alpha wallets, risk flags, and market momentum — distilled into a verdict for every creator token, refreshed live."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
