'use client';

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

function NpmIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" />
    </svg>
  );
}

export function Footer() {
  const { t } = useI18n();

  const documentationLinks = [
    { label: t('nav.gettingStarted'), href: '/getting-started' },
    { label: t('nav.apiReference'), href: '/api-reference' },
    { label: t('nav.benchmarks'), href: '/benchmarks' },
    { label: t('nav.tutorials'), href: '/tutorials' },
  ];

  const resourceLinks = [
    { label: t('nav.architecture'), href: '/architecture' },
    { label: t('nav.contributing'), href: '/contributing' },
    { label: t('nav.faq'), href: '/faq' },
    { label: t('nav.updates'), href: '/updates' },
  ];

  const communityLinks = [
    {
      label: 'GitHub',
      href: 'https://github.com/vcms-io/solidis',
      icon: <GithubIcon className="h-3.5 w-3.5" />,
    },
    {
      label: 'npm',
      href: 'https://www.npmjs.com/package/@vcms-io/solidis',
      icon: <NpmIcon className="h-3.5 w-3.5" />,
    },
    {
      label: t('footer.issues'),
      href: 'https://github.com/vcms-io/solidis/issues',
    },
    {
      label: t('footer.discussions'),
      href: 'https://github.com/vcms-io/solidis/discussions',
    },
  ];

  return (
    <footer className="border-t border-border bg-background">
      <div className="content-container py-12">
        <div className="flex flex-col md:flex-row gap-10 md:gap-16">
          <div className="md:max-w-[260px] shrink-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1 mb-3 transition-opacity hover:opacity-70"
            >
              <img
                src="https://resources.vcms.io/assets/solidis.png"
                alt="Solidis"
                className="h-5 w-5"
              />
              <span className="text-[15px] font-semibold text-foreground">
                Solidis
              </span>
            </Link>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {t('footer.description')}
            </p>
          </div>

          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-8 md:justify-items-end">
            <div className="md:text-right">
              <h4 className="text-[13px] font-medium text-foreground mb-3">
                {t('footer.documentation')}
              </h4>
              <ul className="space-y-2">
                {documentationLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:text-right">
              <h4 className="text-[13px] font-medium text-foreground mb-3">
                {t('footer.resources')}
              </h4>
              <ul className="space-y-2">
                {resourceLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:text-right">
              <h4 className="text-[13px] font-medium text-foreground mb-3">
                {t('footer.community')}
              </h4>
              <ul className="space-y-2">
                {communityLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground md:flex-row-reverse"
                    >
                      {link.icon}
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} VCMS.io. {t('footer.rights')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('footer.mitLicense')}
          </p>
        </div>
      </div>
    </footer>
  );
}
