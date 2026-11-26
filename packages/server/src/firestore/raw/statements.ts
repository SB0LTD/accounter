/**
 * Ports of the raw `client.query('...')` statements (not pgTyped). Transaction control,
 * `set_config(...)` and `SELECT 1 AS health` are handled by the client itself (client.ts).
 */
import type { RawStatement } from './types.js';

export const RAW_STATEMENTS: RawStatement[] = [];
