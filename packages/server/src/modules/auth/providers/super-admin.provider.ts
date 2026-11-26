import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '../../../firestore/sql.js';
import { makeUUID } from '../../../shared/helpers/deterministic-uuid.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type { IGetSuperAdminByAuth0IdQuery } from '../types.js';
import { AuthContextProvider } from './auth-context.provider.js';

const getSuperAdminByAuth0Id = sql<IGetSuperAdminByAuth0IdQuery>`
  SELECT auth0_user_id
  FROM accounter_schema.super_admins
  WHERE auth0_user_id = $auth0UserId
  LIMIT 1;
`;

@Injectable({ scope: Scope.Operation, global: true })
export class SuperAdminProvider {
  constructor(
    private db: TenantAwareDBClient,
    private dbProvider: DBProvider,
    private authContextProvider: AuthContextProvider,
  ) {}

  async isSuperAdmin(auth0UserId: string): Promise<boolean> {
    const rows = await getSuperAdminByAuth0Id.run({ auth0UserId }, this.db);
    return rows.length > 0;
  }

  /**
   * The current user, if they are a super-admin.
   *
   * A super-admin who belongs to no business yet (the operator of a new installation, before the
   * first business exists) has no auth context. Their verified identity is checked against
   * `super_admins` without a tenant (the table is readable by every session), and this operation is
   * then given an operator context: no tenant, and a local user id derived from their identity, so
   * the bootstrap can make them a member of the business it creates.
   */
  async requireSuperAdmin(): Promise<{ userId: string; auth0UserId: string }> {
    const auth = await this.authContextProvider.getAuthContext();
    const auth0UserId = auth?.user?.auth0UserId;
    const userId = auth?.user?.userId;

    if (auth0UserId && userId) {
      const ok = await this.isSuperAdmin(auth0UserId);
      if (!ok) {
        throw new GraphQLError('Super-admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      return { userId, auth0UserId };
    }

    const identity = auth ? null : await this.authContextProvider.getJwtIdentity();
    if (!identity) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
    const rows = await getSuperAdminByAuth0Id.run(
      { auth0UserId: identity.auth0UserId },
      this.dbProvider,
    );
    if (rows.length === 0) {
      throw new GraphQLError('Super-admin access required', {
        extensions: { code: 'FORBIDDEN' },
      });
    }
    const operatorUserId = makeUUID('user', identity.auth0UserId);
    this.authContextProvider.elevateUnprovisionedSuperAdmin(identity, operatorUserId);
    return { userId: operatorUserId, auth0UserId: identity.auth0UserId };
  }
}
