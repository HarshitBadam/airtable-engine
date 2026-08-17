import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import { Toaster } from "sonner";

import { StorageLimitModal } from "~/components/system/StorageLimitModal";
import { TRPCReactProvider } from "~/trpc/react";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Airtable",
    template: "%s - Airtable",
  },
  description: "Airtable",
  icons: [{ rel: "icon", url: "/icon.svg", type: "image/svg+xml" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

// Inter font for Airtable-like UI (Inter Display is a variant of Inter)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${inter.variable}`}>
      <body suppressHydrationWarning>
        <TRPCReactProvider>
          <Providers>{children}</Providers>
        </TRPCReactProvider>
        <StorageLimitModal />
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
