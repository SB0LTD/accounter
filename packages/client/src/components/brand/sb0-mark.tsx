import type { ReactElement } from 'react';
import { cn } from '../../lib/utils.js';

/** SB0 LTD's home page: the company that runs this Accounter service. */
export const SB0_URL = 'https://sb0.tech';

/**
 * The SB0 LTD shield, the logo on the Google sign-in consent screen. Pages that people reach before
 * or while signing in show it, so the brand Google names is the brand they see.
 */
export function Sb0Mark({ className }: { className?: string }): ReactElement {
  return <img src="/icons/sb0-logo.png" alt="SB0 LTD" className={cn('rounded-md', className)} />;
}
