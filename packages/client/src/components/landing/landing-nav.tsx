import type { ReactElement } from 'react';
import { useLogin } from '../../hooks/use-login.js';
import { Button } from '../ui/button.js';
import { REQUEST_ACCESS_URL } from './landing-content.js';
import { useLandingContent } from './landing-i18n.js';
import { LandingLangToggle } from './landing-lang-toggle.js';

export function LandingNav(): ReactElement {
  const login = useLogin();
  const { content } = useLandingContent();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/85 backdrop-blur-sm">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <a href="#top" className="flex items-center gap-2">
          <img src="/icons/accounter-logo.svg" alt="" className="h-7 w-7" />
          <span className="text-lg font-semibold tracking-tight text-gray-950">Accounter</span>
        </a>

        <ul className="hidden items-center gap-7 lg:flex">
          {content.nav.sections.map(section => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-sm text-gray-600 transition-colors hover:text-gray-950"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1 sm:gap-2">
          <LandingLangToggle />
          {/* To the sign-in page (Google, or email and password), then into the app. */}
          <Button variant="ghost" className="px-3 sm:px-4" onClick={() => void login()}>
            {content.nav.login}
          </Button>
          {/* On a phone the bar has no room for it; the hero's own request-access button sits on
              the first screen. */}
          <Button asChild className="hidden sm:inline-flex">
            <a href={REQUEST_ACCESS_URL}>{content.nav.requestAccess}</a>
          </Button>
        </div>
      </nav>
    </header>
  );
}
