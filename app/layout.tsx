import type { Metadata, Viewport } from "next";
import { Archivo, Public_Sans } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-archivo", display: "swap" });
const publicSans = Public_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-public", display: "swap" });

export const metadata: Metadata = {
  title: "TriaSiap - Triase START dan Pencatatan Korban",
  description: "Triase START, pencatatan korban, dan pemantauan evakuasi dalam satu dashboard.",
  icons: { icon: "/logo.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${archivo.variable} ${publicSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
