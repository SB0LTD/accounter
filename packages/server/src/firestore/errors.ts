/**
 * Errors shaped like `pg`'s DatabaseError, so code that checks `error.code` / `error.constraint`
 * keeps working: 23505 unique, 23503 foreign key, 23502 not null, 23514 check, 42501 RLS.
 */
export class DbError extends Error {
  readonly severity = 'ERROR';
  constructor(
    message: string,
    readonly code: string,
    readonly details: {
      constraint?: string;
      table?: string;
      column?: string;
      detail?: string;
    } = {},
  ) {
    super(message);
    this.name = 'error';
  }

  get constraint() {
    return this.details.constraint;
  }

  get table() {
    return this.details.table;
  }

  get column() {
    return this.details.column;
  }

  get detail() {
    return this.details.detail;
  }

  get schema() {
    return this.details.table ? 'accounter_schema' : undefined;
  }
}

export const uniqueViolation = (table: string, constraint: string, detail?: string) =>
  new DbError(`duplicate key value violates unique constraint "${constraint}"`, '23505', {
    table,
    constraint,
    detail,
  });

export const foreignKeyViolation = (table: string, constraint: string, detail?: string) =>
  new DbError(
    `insert or update on table "${table}" violates foreign key constraint "${constraint}"`,
    '23503',
    { table, constraint, detail },
  );

export const foreignKeyStillReferenced = (table: string, constraint: string, child: string) =>
  new DbError(
    `update or delete on table "${table}" violates foreign key constraint "${constraint}" on table "${child}"`,
    '23503',
    { table: child, constraint },
  );

export const notNullViolation = (table: string, column: string) =>
  new DbError(
    `null value in column "${column}" of relation "${table}" violates not-null constraint`,
    '23502',
    { table, column },
  );

export const checkViolation = (table: string, constraint: string) =>
  new DbError(
    `new row for relation "${table}" violates check constraint "${constraint}"`,
    '23514',
    {
      table,
      constraint,
    },
  );

export const rlsViolation = (table: string) =>
  new DbError(`new row violates row-level security policy for table "${table}"`, '42501', {
    table,
  });

export const unportedSql = (text: string) =>
  new DbError(`Firestore store: no port for SQL statement: ${text.trim().slice(0, 300)}`, '0A000');
