import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Providers } from "@/components/admin/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FXT ID Cards", template: "%s · FXT ID Cards" },
  description: "Fast Express Transport employee ID card management and verification.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/logo.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1020" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
