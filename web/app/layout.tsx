import type { Metadata } from "next";
import "./globals.css";

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
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
