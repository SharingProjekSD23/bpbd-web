import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIAGA — BPBD Kota Semarang",
  description: "Prototipe sistem data kebencanaan BPBD Kota Semarang. Seluruh data adalah data demo.",
  icons: {
    icon: "/logo-bpbd.png",
    shortcut: "/logo-bpbd.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
