import type { ReactElement } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../router/routes.js';
import { SB0_URL, Sb0Mark } from '../brand/sb0-mark.js';
import { Button } from '../ui/button.js';
import { BrandIcon, GITHUB_MARK } from './landing-brand-icons.js';
import { GITHUB_URL, REQUEST_ACCESS_URL } from './landing-content.js';
import { useLandingContent } from './landing-i18n.js';

const GUILD_URL = 'https://the-guild.dev';

export function LandingFooter(): ReactElement {
  const { content } = useLandingContent();
  const { footer } = content;

  return (
    <footer className="bg-gray-950 text-gray-300">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl">
            {footer.title}
          </h2>
          <p className="mt-4 text-lg text-pretty text-gray-400">{footer.description}</p>
          <Button asChild size="lg" variant="secondary" className="mt-8">
            <a href={REQUEST_ACCESS_URL}>
              {footer.requestAccess}
              <ArrowRight className="rtl:rotate-180" />
            </a>
          </Button>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-gray-800 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            {/* The company that runs the service: the brand on Google's sign-in screen. */}
            <a href={SB0_URL} className="flex items-center gap-3">
              <Sb0Mark className="h-10 w-10" />
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-white">Accounter</span>
                <span className="text-xs text-gray-400">{footer.operatedBy}</span>
              </span>
            </a>
            <nav aria-label="Legal" className="flex items-center gap-4 text-sm text-gray-400">
              <Link to={ROUTES.PRIVACY} className="transition-colors hover:text-white">
                {footer.privacy}
              </Link>
              <Link to={ROUTES.TERMS} className="transition-colors hover:text-white">
                {footer.terms}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-5 text-gray-400">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="transition-colors hover:text-white"
            >
              <BrandIcon mark={GITHUB_MARK} className="h-6 w-6 fill-current" />
            </a>
            {/* The open-source code's maintainers, credited in words: the logo here is SB0's. */}
            <a
              href={GUILD_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm transition-colors hover:text-white"
            >
              {footer.openSource}
            </a>
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-xs leading-5 text-gray-500">
          {footer.signInNote}{' '}
          <Link to={ROUTES.PRIVACY} className="underline underline-offset-2 hover:text-white">
            {footer.privacy}
          </Link>
          {' · '}© {new Date().getFullYear()} SB0 LTD
        </p>
      </div>
    </footer>
  );
}
