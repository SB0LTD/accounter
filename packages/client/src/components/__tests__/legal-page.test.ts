import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { LegalPage } from '../legal/index.js';
import { LEGAL_COPY, type LegalDocId } from '../legal/legal-content.js';
import { ROUTES } from '../../router/routes.js';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

const LANG_KEY = 'accounter-landing-lang';

async function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: ROUTES.PRIVACY, element: React.createElement(LegalPage, { doc: 'privacy' }) },
      { path: ROUTES.TERMS, element: React.createElement(LegalPage, { doc: 'terms' }) },
    ],
    { initialEntries: [path] },
  );
  const container = document.createElement('div');
  document.body.append(container);
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(RouterProvider, { router }));
    await Promise.resolve();
  });
  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };
  return { container, cleanup };
}

describe('LegalPage', () => {
  afterEach(() => {
    localStorage.removeItem(LANG_KEY);
  });

  it('shows the privacy policy in Hebrew by default, with the Google user data statement', async () => {
    const { container, cleanup } = await renderAt(ROUTES.PRIVACY);

    expect(container.querySelector('h1')?.textContent).toBe('מדיניות פרטיות');
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
    const googlePolicy = container.querySelector(
      'a[href="https://developers.google.com/terms/api-services-user-data-policy"]',
    );
    expect(googlePolicy).not.toBeNull();
    expect(container.textContent).toContain('Limited Use');
    await cleanup();
  });

  it('shows the terms in English when that is the chosen language, linking the other page', async () => {
    localStorage.setItem(LANG_KEY, 'en');
    const { container, cleanup } = await renderAt(ROUTES.TERMS);

    expect(container.querySelector('h1')?.textContent).toBe('Terms of Service');
    const privacyLinks = [...container.querySelectorAll(`a[href="${ROUTES.PRIVACY}"]`)];
    expect(privacyLinks.map(a => a.textContent)).toContain('Privacy Policy');
    await cleanup();
  });
});

describe('legal copy', () => {
  it.each<LegalDocId>(['privacy', 'terms'])(
    'keeps the Hebrew and English %s in step, section for section',
    doc => {
      const he = LEGAL_COPY.he.documents[doc];
      const en = LEGAL_COPY.en.documents[doc];
      expect(he.sections.length).toBe(en.sections.length);
      he.sections.forEach((section, index) => {
        const blocks = (s: typeof section) =>
          s.body.map(block => (typeof block === 'string' ? 'p' : `list:${block.list.length}`));
        expect(blocks(section)).toEqual(blocks(en.sections[index]));
      });
    },
  );
});
