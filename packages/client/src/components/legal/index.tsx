import { Fragment, useEffect, type ReactElement, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../router/routes.js';
import { LandingLangProvider, useLandingContent } from '../landing/landing-i18n.js';
import { LandingLangToggle } from '../landing/landing-lang-toggle.js';
import { useDocumentScroll } from '../landing/use-document-scroll.js';
import {
  LEGAL_COPY,
  LEGAL_OPERATOR,
  LEGAL_UPDATED_ISO,
  type LegalBlock,
  type LegalDocId,
} from './legal-content.js';

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const LINK_CLASS = 'font-medium text-gray-950 underline underline-offset-2 hover:text-gray-600';

/** Renders text with `[text](href)` links: app paths as router links, the rest as plain links. */
export function LegalText({ text }: { text: string }): ReactElement {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const [whole, label, href] = match;
    parts.push(text.slice(last, match.index));
    if (href.startsWith('/')) {
      parts.push(
        <Link key={match.index} to={href} className={LINK_CLASS}>
          {label}
        </Link>,
      );
    } else {
      const external = href.startsWith('http');
      parts.push(
        <a
          key={match.index}
          href={href}
          className={LINK_CLASS}
          {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          // Addresses and URLs read left to right inside Hebrew text.
          dir={label.includes('@') || label.startsWith('http') ? 'ltr' : undefined}
        >
          {label}
        </a>,
      );
    }
    last = match.index + whole.length;
  }
  parts.push(text.slice(last));
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </>
  );
}

function Block({ block }: { block: LegalBlock }): ReactElement {
  if (typeof block === 'string') {
    return (
      <p className="mt-4 leading-7 text-gray-700">
        <LegalText text={block} />
      </p>
    );
  }
  return (
    <ul className="mt-4 list-disc space-y-2 ps-6 leading-7 text-gray-700 marker:text-gray-400">
      {block.list.map(item => (
        <li key={item}>
          <LegalText text={item} />
        </li>
      ))}
    </ul>
  );
}

/**
 * The public privacy policy (`/privacy`) and terms of service (`/terms`), in the landing page's
 * language (Hebrew by default). Open with or without a session: Google's sign-in consent screen
 * links here.
 */
export function LegalPage({ doc }: { doc: LegalDocId }): ReactElement {
  useDocumentScroll();

  return (
    <LandingLangProvider>
      <LegalDocumentView doc={doc} />
    </LandingLangProvider>
  );
}

function LegalDocumentView({ doc }: { doc: LegalDocId }): ReactElement {
  const { lang, content } = useLandingContent();
  const copy = LEGAL_COPY[lang];
  const legalDoc = copy.documents[doc];
  const other: LegalDocId = doc === 'privacy' ? 'terms' : 'privacy';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [doc]);

  return (
    <div dir={content.dir} lang={lang} className="min-h-screen bg-white antialiased">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/85 backdrop-blur-sm">
        <nav
          aria-label="Main"
          className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-4 px-4 sm:px-6"
        >
          <Link to={ROUTES.HOME} className="flex items-center gap-2">
            <img src="/icons/accounter-logo.svg" alt="" className="h-7 w-7" />
            <span className="text-lg font-semibold tracking-tight text-gray-950">Accounter</span>
          </Link>
          <LandingLangToggle />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
          {legalDoc.title}
        </h1>
        <p className="mt-3 text-sm text-gray-500">
          <time dateTime={LEGAL_UPDATED_ISO}>{copy.updated}</time>
        </p>
        {legalDoc.intro.map(block => (
          <Block key={typeof block === 'string' ? block : block.list[0]} block={block} />
        ))}

        {legalDoc.sections.map((section, index) => (
          <section key={section.heading} className="mt-10">
            <h2 className="text-xl font-semibold text-gray-950">
              {index + 1}. {section.heading}
            </h2>
            {section.body.map(block => (
              <Block key={typeof block === 'string' ? block : block.list[0]} block={block} />
            ))}
          </section>
        ))}

        <p className="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-500">
          {copy.versionNote}
        </p>
      </main>

      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-gray-500 sm:px-6">
          <span>
            © {LEGAL_UPDATED_ISO.slice(0, 4)} {LEGAL_OPERATOR}
          </span>
          <nav aria-label="Legal" className="flex items-center gap-4">
            <Link to={ROUTES.HOME} className="hover:text-gray-950">
              {copy.home}
            </Link>
            <Link
              to={other === 'privacy' ? ROUTES.PRIVACY : ROUTES.TERMS}
              className="hover:text-gray-950"
            >
              {copy.documents[other].title}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
