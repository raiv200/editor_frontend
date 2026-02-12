// src/app/layout.tsx

import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";


export const metadata: Metadata = {
  title: "Raspond - RFP Collaboration Platform",
  description: "Collaborative RFP response platform with AI assistance",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={``}>
      <body className={`antialiased font-inter`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}