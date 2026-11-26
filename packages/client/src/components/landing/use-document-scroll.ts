import { useEffect } from 'react';

/**
 * Lets a full-page public document (landing, privacy, terms) scroll normally. The app shell locks
 * scrolling on `.dashboard` screens via `h-screen overflow-hidden`, and MUI's CssBaseline leaves
 * whatever the previous route set.
 */
export function useDocumentScroll(): void {
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
}
