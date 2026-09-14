import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Jornada360 — Auditoria de Jornada",
  description:
    "Plataforma corporativa de auditoria, conciliação e gestão de jornada. Transforme arquivos de ponto, rastreamento e escalas em pendências acionáveis.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
