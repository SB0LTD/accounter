import type { ReactElement } from 'react';
import { LandingAssistant } from './landing-assistant.js';
import { LandingCompliance } from './landing-compliance.js';
import { LandingFeatures } from './landing-features.js';
import { LandingFooter } from './landing-footer.js';
import { LandingHero } from './landing-hero.js';
import { LandingHowItWorks } from './landing-how-it-works.js';
import { LandingLangProvider, useLandingContent } from './landing-i18n.js';
import { LandingIntegrations } from './landing-integrations.js';
import { LandingNav } from './landing-nav.js';
import { LandingOpenSource } from './landing-open-source.js';
import { LandingRoles } from './landing-roles.js';
import { useDocumentScroll } from './use-document-scroll.js';

/**
 * Public marketing page served at `/` to visitors without a session.
 *
 * Static by design: no GraphQL, no loaders, no viewer lookup. `LandingRoute`
 * decides whether this renders at all, so nothing here needs to know about auth
 * beyond the request-access link.
 *
 * Bilingual (Hebrew default) — see `landing-i18n.tsx`. Direction is set on the
 * page root, not on `<html>`, so the rest of the app is unaffected.
 */
export function LandingPage(): ReactElement {
  useDocumentScroll();

  return (
    <LandingLangProvider>
      <LandingDocument />
    </LandingLangProvider>
  );
}

function LandingDocument(): ReactElement {
  const { lang, content } = useLandingContent();

  return (
    <div dir={content.dir} lang={lang} className="min-h-screen bg-white antialiased">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingRoles />
        <LandingAssistant />
        <LandingHowItWorks />
        <LandingCompliance />
        <LandingFeatures />
        <LandingIntegrations />
        <LandingOpenSource />
      </main>
      <LandingFooter />
    </div>
  );
}
