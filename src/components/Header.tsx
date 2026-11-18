import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import type { Language } from '../types';
import { UI_TEXT } from '../i18n';

interface HeaderProps {
  ownerName: string;
  avatarUrl?: string;
  lang: Language;
  isAdmin: boolean;
  onOpenAdmin: () => void;
}

export function Header({ ownerName, avatarUrl, lang, isAdmin, onOpenAdmin }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = UI_TEXT[lang];

  const navItems = [
    { href: '#about', label: t.nav.about },
    { href: '#skills', label: t.nav.skills },
    { href: '#announcements', label: t.nav.announcements },
    { href: '#vault', label: t.nav.vault },
    { href: '#community', label: t.nav.community },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-50/90 dark:bg-[#070B14]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark with circular logo */}
        <a
          href="#top"
          className="inline-flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 hover:text-blue-700 dark:hover:text-sky-300 transition-colors whitespace-nowrap shrink-0"
        >
          <img
            src="/assets/aistudio/image_2df75c9c.png"
            alt={`${ownerName} logo`}
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-600/35 dark:ring-sky-400/45 shrink-0"
          />
          <span>{ownerName}</span>
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="hover:text-blue-700 dark:hover:text-sky-300 underline-offset-8 hover:underline decoration-2 decoration-blue-600/70 dark:decoration-sky-400/80 transition-colors whitespace-nowrap shrink-0"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenAdmin}
            className="hidden md:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 dark:from-blue-600 dark:to-sky-600 dark:hover:from-blue-500 dark:hover:to-sky-500 rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isAdmin ? t.nav.admin : t.nav.admin}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800/80 hover:text-blue-700 dark:hover:text-sky-300"
            >
              {item.label}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setMobileOpen(false)}
            className="block py-2.5 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800/80 hover:text-blue-700 dark:hover:text-sky-300"
          >
            {t.nav.contact}
          </a>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onOpenAdmin();
            }}
            className="w-full mt-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-600 dark:to-sky-600 rounded-lg text-center"
          >
            {t.nav.admin}
          </button>
        </div>
      )}
    </header>
  );
}
