import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BagsRadar",
  description: "Real-time alpha radar for Bags token launches."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
