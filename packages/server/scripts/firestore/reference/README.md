Reference material for the Firestore port (generated, read-only):

- schema.sql: pg_dump --schema-only of a database built by all migrations (Postgres 18). The
  trigger functions (insert_*_transaction_handler) and views are defined here.
