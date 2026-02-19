import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Proposal Evaluator",
  description: "Evaluate proposals with AI-powered agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
