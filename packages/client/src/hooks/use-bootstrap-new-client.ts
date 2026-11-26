import { useCallback } from 'react';
import type { CombinedError } from 'urql';
import {
  BootstrapNewClientDocument,
  type BootstrapClientInput,
  type BootstrapNewClientMutation,
} from '../gql/graphql.js';
import { MUTATION_DEDUPE_WINDOW_MS } from '../helpers/mutation-dedupe.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation BootstrapNewClient($input: BootstrapClientInput!) {
    bootstrapNewClient(input: $input) {
      id
      invitationToken
      business {
        id
        name
      }
    }
  }
`;

type UseBootstrapNewClient = {
  fetching: boolean;
  error: CombinedError | undefined;
  bootstrapNewClient: (
    input: BootstrapClientInput,
  ) => Promise<BootstrapNewClientMutation['bootstrapNewClient'] | void>;
};

const NOTIFICATION_ID = 'bootstrapNewClient';

/** Creates a new client business and its owner's invitation (super-admins only, enforced by the API). */
export const useBootstrapNewClient = (): UseBootstrapNewClient => {
  const { fetching, error, execute } = useApiMutation({
    document: BootstrapNewClientDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Creating business',
    errorMessage: 'Error creating business',
    select: data => data.bootstrapNewClient,
    successToast: { description: 'Business created' },
    errorToast: { duration: 10_000 },
    // Creates a business: an accidental repeat would create a second one.
    dedupe: { windowMs: MUTATION_DEDUPE_WINDOW_MS },
  });

  const bootstrapNewClient = useCallback(
    (input: BootstrapClientInput) => execute({ input }),
    [execute],
  );

  return { fetching, error, bootstrapNewClient };
};
