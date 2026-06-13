'use client';

import { Languages } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n-context';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  const toggleLanguage = () => {
    setLocale(locale === 'en' ? 'ko' : 'en');
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="flex items-center gap-2"
      aria-label="Switch language"
    >
      <Languages className="h-4 w-4" />
      <span className="font-medium">{locale === 'en' ? 'KO' : 'EN'}</span>
    </Button>
  );
}
