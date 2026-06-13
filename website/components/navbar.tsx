'use client';

import { ExternalLink, Menu } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { LanguageSwitcher } from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useI18n } from '@/lib/i18n-context';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n();

  const navigation = [
    { name: t('nav.gettingStarted'), href: '/getting-started' },
    { name: t('nav.architecture'), href: '/architecture' },
    { name: t('nav.apiReference'), href: '/api-reference' },
    { name: t('nav.benchmarks'), href: '/benchmarks' },
    { name: t('nav.tutorials'), href: '/tutorials' },
    { name: t('nav.contributing'), href: '/contributing' },
    { name: t('nav.faq'), href: '/faq' },
    { name: t('nav.updates'), href: '/updates' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <img
            src="https://resources.vcms.io/assets/solidis.png"
            alt="Solidis Logo"
            className="h-8 w-8"
          />
          <span className="font-bold text-xl">Solidis</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-6">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center space-x-2">
          <LanguageSwitcher />
          <Button
            variant="outline"
            size="sm"
            className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
            asChild
          >
            <Link href="https://github.com/vcms-io/solidis" target="_blank">
              <GithubIcon className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('nav.github')}</span>
              <span className="sm:hidden">GH</span>
              <ExternalLink className="h-3 w-3 ml-1" />
            </Link>
          </Button>

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
  );
}
