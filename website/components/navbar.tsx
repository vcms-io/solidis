"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, Github, ExternalLink } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"
import { LanguageSwitcher } from "@/components/language-switcher"

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useI18n()

  const navigation = [
    { name: t("nav.gettingStarted"), href: "/getting-started" },
    { name: t("nav.architecture"), href: "/architecture" },
    { name: t("nav.apiReference"), href: "/api-reference" },
    { name: t("nav.benchmarks"), href: "/benchmarks" },
    { name: t("nav.tutorials"), href: "/tutorials" },
    { name: t("nav.contributing"), href: "/contributing" },
    { name: t("nav.faq"), href: "/faq" },
    { name: t("nav.updates"), href: "/updates" },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <img src="https://resources.vcms.io/assets/solidis.png" alt="Solidis Logo" className="h-8 w-8" />
          <span className="font-bold text-xl">Solidis</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          {navigation.map((item) => (
            <Link key={item.name} href={item.href} className="text-sm font-medium transition-colors hover:text-primary">
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center space-x-2">
          <LanguageSwitcher />
          <Button variant="outline" size="sm" className="border-yellow-500 text-yellow-600 hover:bg-yellow-50" asChild>
            <Link href="https://github.com/vcms-io/solidis" target="_blank">
              <Github className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t("nav.github")}</span>
              <span className="sm:hidden">GH</span>
              <ExternalLink className="h-3 w-3 ml-1" />
            </Link>
          </Button>

          {/* Mobile Navigation */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <div className="flex flex-col space-y-4 mt-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="text-lg font-medium"
                    onClick={() => setIsOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
