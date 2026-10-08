import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NimbusStack Knowledge Assistant",
  description: "Ask product questions; answers come only from NimbusStack's documentation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
