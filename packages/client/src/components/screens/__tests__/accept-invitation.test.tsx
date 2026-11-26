// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AcceptInvitationPage } from '../accept-invitation.js';
import { ROUTES } from '../../../router/routes.js';

const {
  useFirebaseAuthMock,
  useAcceptInvitationMock,
  loginMock,
  acceptInvitationMock,
  navigateMock,
  hookState,
  routeToken,
} = vi.hoisted(() => ({
  useFirebaseAuthMock: vi.fn(),
  useAcceptInvitationMock: vi.fn(),
  loginMock: vi.fn<(options?: { returnTo?: string; isReauth?: boolean }) => Promise<void>>(),
  acceptInvitationMock: vi.fn(),
  navigateMock: vi.fn(),
  hookState: {
    fetching: false,
    error: undefined as MutationError | undefined,
  },
  routeToken: { value: 'invite-token-123' },
}));

vi.mock('../../../lib/firebase-auth.js', () => ({
  useFirebaseAuth: useFirebaseAuthMock,
}));

vi.mock('../../../hooks/use-login.js', () => ({
  useLogin: () => loginMock,
}));

vi.mock('../../../hooks/use-accept-invitation.js', () => ({
  useAcceptInvitation: useAcceptInvitationMock,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ token: routeToken.value }),
  };
});

vi.mock('../../ui/button.js', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) =>
    React.createElement('button', props, children),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type MutationError = {
  graphQLErrors?: Array<{ message?: string }>;
};

async function renderScreen(): Promise<{ container: HTMLDivElement; cleanup: () => Promise<void> }> {
  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(AcceptInvitationPage));
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

function mockAuthState({
  isAuthenticated,
  isLoading,
}: {
  isAuthenticated: boolean;
  isLoading?: boolean;
}) {
  useFirebaseAuthMock.mockReturnValue({
    isAuthenticated,
    isLoading: isLoading ?? false,
  });
}

function mockMutationState({
  fetching = false,
  error,
}: {
  fetching?: boolean;
  error?: MutationError;
}) {
  hookState.fetching = fetching;
  hookState.error = error;
}

describe('AcceptInvitationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    loginMock.mockResolvedValue(undefined);
    routeToken.value = 'invite-token-123';
    acceptInvitationMock.mockResolvedValue({
      success: true,
      businessId: 'business-1',
      roleId: 'employee',
    });
    mockMutationState({});
    useAcceptInvitationMock.mockImplementation(() => ({
      fetching: hookState.fetching,
      error: hookState.error,
      acceptInvitation: acceptInvitationMock,
    }));
  });

  it('shows a sign-in prompt for unauthenticated users and hides accept action', async () => {
    mockAuthState({ isAuthenticated: false });

    const { container, cleanup } = await renderScreen();

    expect(container.textContent).toContain("You've been invited!");
    expect(container.textContent).toContain('Sign in to accept');
    expect(container.textContent).not.toContain('Accept Invitation');

    await cleanup();
  });

  it('waits for the stored session before offering anything', async () => {
    mockAuthState({ isAuthenticated: false, isLoading: true });

    const { container, cleanup } = await renderScreen();

    expect(container.textContent).toContain('Loading invitation...');
    expect(container.querySelector('button')).toBeNull();

    await cleanup();
  });

  it('sends the user to sign in, and back to this invitation after', async () => {
    mockAuthState({ isAuthenticated: false });

    const { container, cleanup } = await renderScreen();

    const loginButton = Array.from(container.querySelectorAll('button')).find(button =>
      /sign in to accept/i.test(button.textContent ?? ''),
    );
    expect(loginButton).toBeTruthy();

    await act(async () => {
      loginButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const invitation = ROUTES.ACCEPT_INVITATION('invite-token-123');
    expect(loginMock).toHaveBeenCalledWith({ returnTo: invitation });
    // Remembered apart from any other destination, so sign-in comes back here first.
    expect(sessionStorage.getItem('auth:invitationReturnTo')).toBe(invitation);

    await cleanup();
  });

  it('shows accept button for authenticated users', async () => {
    mockAuthState({ isAuthenticated: true });

    const { container, cleanup } = await renderScreen();

    expect(container.textContent).toContain('Accept Invitation');

    await cleanup();
  });

  it('redirects to home after successful invitation acceptance', async () => {
    mockAuthState({ isAuthenticated: true });
    acceptInvitationMock.mockResolvedValue({
      success: true,
      businessId: 'business-1',
      roleId: 'employee',
    });

    const { container, cleanup } = await renderScreen();

    const acceptButton = Array.from(container.querySelectorAll('button')).find(button =>
      /accept invitation/i.test(button.textContent ?? ''),
    );
    expect(acceptButton).toBeTruthy();

    await act(async () => {
      acceptButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(acceptInvitationMock).toHaveBeenCalledWith('invite-token-123');
    expect(navigateMock).toHaveBeenCalledWith(ROUTES.APP_HOME, { replace: true });

    await cleanup();
  });

  it('shows mutation error message when acceptance fails', async () => {
    mockAuthState({ isAuthenticated: true });
    mockMutationState({
      error: { graphQLErrors: [{ message: 'Invitation could not be accepted' }] },
    });

    const { container, cleanup } = await renderScreen();

    expect(container.textContent).toContain('Invitation could not be accepted');

    await cleanup();
  });

  it('shows TOKEN_EXPIRED error when invitation token is expired', async () => {
    mockAuthState({ isAuthenticated: true });
    mockMutationState({ error: { graphQLErrors: [{ message: 'TOKEN_EXPIRED' }] } });

    const { container, cleanup } = await renderScreen();

    expect(container.textContent).toContain('This invitation link has expired');

    await cleanup();
  });
});
