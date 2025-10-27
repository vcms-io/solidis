import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { I18nProvider } from "@/lib/i18n-context"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Solidis Documentation - High-Performance Redis Client",
  description:
    "Official documentation for Solidis, a high-performance SOLID-structured RESP client for Redis and other RESP-compatible servers.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <I18nProvider>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  )
}
