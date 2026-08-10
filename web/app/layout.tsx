import type { Metadata } from "next";
import { Suspense } from "react";
import { LegacyVersionSwitcher } from "@/components/v2";
import "./globals.css";
import "./v2.css";

export const metadata: Metadata = {
  title: "Fab ERP",
  description: "uPVC fabrication ERP for quotes, orders, catalog pricing, and production documents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <Suspense fallback={null}>
          <LegacyVersionSwitcher />
        </Suspense>
      </body>
    </html>
  );
}
