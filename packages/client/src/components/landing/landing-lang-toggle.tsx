import type { ReactElement } from 'react';
import type { LandingLang } from './landing-content.js';
import { useLandingContent } from './landing-i18n.js';

const LANG_OPTIONS: { value: LandingLang; label: string }[] = [
  { value: 'he', label: 'עברית' },
  { value: 'en', label: 'EN' },
];

/** The Hebrew / English switch of the public pages (landing, privacy, terms). */
export function LandingLangToggle(): ReactElement {
  const { lang, setLang } = useLandingContent();

  return (
    <div
      role="group"
      aria-label="Language"
      className="flex overflow-hidden rounded-full border border-gray-200 text-xs font-semibold"
    >
      {LANG_OPTIONS.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLang(option.value)}
          aria-pressed={lang === option.value}
          className={
            lang === option.value
              ? 'bg-gray-950 px-2.5 py-1.5 text-white sm:px-3'
              : 'px-2.5 py-1.5 text-gray-500 transition-colors hover:text-gray-950 sm:px-3'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
