import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Keylo Uganda",
  description: "Vehicle financing with consent-first credit decisions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
