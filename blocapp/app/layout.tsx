import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "BlocApp — Administrare Asociații de Proprietari",
  description: "Gestionează lista de întreținere, plăți și comunicarea cu locatarii.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ro" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
