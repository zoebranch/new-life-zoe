import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zoe Branch | New Life Christian Center",
  description: "Find a Zoe Branch cell, request to join, and connect with your church community.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
