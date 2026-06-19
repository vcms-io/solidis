'use client';

import { Mail } from 'lucide-react';
import Link from 'next/link';

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

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="bg-gray-900 text-white py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <img
                src="https://resources.vcms.io/assets/solidis.png"
                alt="Solidis Logo"
                className="h-8 w-8"
              />
              <span className="font-bold text-xl">Solidis</span>
            </div>
            <p className="text-gray-400 text-sm">{t('footer.description')}</p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">{t('footer.documentation')}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/getting-started"
                  className="text-gray-400 hover:text-white"
                >
                  {t('nav.gettingStarted')}
                </Link>
              </li>
              <li>
                <Link
                  href="/architecture"
                  className="text-gray-400 hover:text-white"
                >
                  {t('nav.architecture')}
                </Link>
              </li>
              <li>
                <Link
                  href="/api-reference"
                  className="text-gray-400 hover:text-white"
                >
                  {t('nav.apiReference')}
                </Link>
              </li>
              <li>
                <Link
                  href="/benchmarks"
                  className="text-gray-400 hover:text-white"
                >
                  {t('nav.benchmarks')}
                </Link>
              </li>
              <li>
                <Link
                  href="/tutorials"
                  className="text-gray-400 hover:text-white"
                >
                  {t('nav.tutorials')}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-400 hover:text-white">
                  {t('nav.faq')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">{t('footer.community')}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="https://github.com/vcms-io/solidis"
                  className="text-gray-400 hover:text-white"
                >
                  {t('nav.github')}
                </Link>
              </li>
              <li>
                <Link
                  href="https://github.com/vcms-io/solidis/issues"
                  className="text-gray-400 hover:text-white"
                >
                  Issues
                </Link>
              </li>
              <li>
                <Link
                  href="https://github.com/vcms-io/solidis/discussions"
                  className="text-gray-400 hover:text-white"
                >
                  Discussions
                </Link>
              </li>
              <li>
                <Link
                  href="/contributing"
                  className="text-gray-400 hover:text-white"
                >
                  {t('nav.contributing')}
                </Link>
              </li>
              <li>
                <Link
                  href="/updates"
                  className="text-gray-400 hover:text-white"
                >
                  {t('nav.updates')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">{t('footer.connect')}</h3>
            <div className="flex space-x-4">
              <Link
                href="https://github.com/vcms-io/solidis"
                className="text-gray-400 hover:text-white"
              >
                <GithubIcon className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white">
                <XIcon className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white">
                <Mail className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; 2026 VCMS.io. {t('footer.rights')}</p>
        </div>
      </div>
    </footer>
  );
}
