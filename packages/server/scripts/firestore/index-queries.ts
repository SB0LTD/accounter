/**
 * Indexes every pgTyped `sql` query in the server and wires it to its Firestore port.
 *
 *   yarn workspace @accounter/server firestore:queries          # write the index, print coverage
 *   yarn workspace @accounter/server firestore:queries --check  # fail if the index is stale
 *
 * A query declared as `const name = sql<IType>\`...\`` in `src/<path>.ts` is ported by
 * `export const name = port<IType>(...)` in `src/firestore/queries/<path>.ts`. The index maps the
 * query's key (a hash of its SQL, see src/firestore/sql.ts) to that export.
 *
 * When an upstream merge changes a query's SQL, its key changes and the port no longer matches:
 * the coverage report lists it as "changed", with the port it used to have.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { queryKey } from '../../src/firestore/sql.js';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, '../../src');
const portsDir = resolve(srcDir, 'firestore/queries');
const indexFile = resolve(portsDir, 'index.generated.ts');
/** SQL text per key, for the verification harness (not shipped). */
const sqlFile = resolve(here, 'queries.sql.generated.json');

interface FoundQuery {
  file: string; // relative to src, forward slashes
  name: string;
  key: string;
  type: string | null;
  line: number;
  text: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (
        [
          '__generated__',
          '__tests__',
          'firestore',
          'node_modules',
          'demo-fixtures',
          'test-utils',
        ].includes(entry)
      )
        continue;
      walk(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function findQueries(file: string): FoundQuery[] {
  const text = readFileSync(file, 'utf8');
  if (!text.includes('sql')) return [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found: FoundQuery[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isTaggedTemplateExpression(node) &&
      ts.isIdentifier(node.tag) &&
      node.tag.text === 'sql'
    ) {
      if (!ts.isNoSubstitutionTemplateLiteral(node.template)) {
        throw new Error(`${file}: sql template with substitutions is not supported`);
      }
      let owner: ts.Node = node.parent;
      while (owner && !ts.isVariableDeclaration(owner)) owner = owner.parent;
      if (!owner || !ts.isIdentifier(owner.name)) {
        throw new Error(`${file}: sql query not assigned to a const`);
      }
      found.push({
        file: relative(srcDir, file).replaceAll('\\', '/'),
        name: owner.name.text,
        key: queryKey(node.template.text),
        type: node.typeArguments?.[0]?.getText(source) ?? null,
        text: node.template.text,
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function portExports(portFile: string): Set<string> {
  if (!existsSync(portFile)) return new Set();
  const text = readFileSync(portFile, 'utf8');
  return new Set(
    [...text.matchAll(/^export const (\w+)\s*[:=]/gm)]
      .map(m => m[1]!)
      .filter(name => name !== 'cases'),
  );
}

function main() {
  const check = process.argv.includes('--check');
  const queries = walk(srcDir).flatMap(findQueries);

  const keys = new Map<string, FoundQuery>();
  for (const query of queries) {
    const clash = keys.get(query.key);
    if (clash) {
      // Two identical SQL texts share one key, and so must share one port.
      console.warn(`same SQL in ${clash.file}#${clash.name} and ${query.file}#${query.name}`);
      continue;
    }
    keys.set(query.key, query);
  }

  const imports: string[] = [];
  const entries: string[] = [];
  const moduleAlias = new Map<string, string>();
  let ported = 0;
  const missing: FoundQuery[] = [];
  for (const query of [...keys.values()].sort((a, b) =>
    (a.file + a.name).localeCompare(b.file + b.name),
  )) {
    const portFile = resolve(portsDir, query.file);
    const exported = portExports(portFile);
    let impl = '';
    if (exported.has(query.name)) {
      let alias = moduleAlias.get(query.file);
      if (!alias) {
        alias = `m${moduleAlias.size}`;
        moduleAlias.set(query.file, alias);
        imports.push(`import * as ${alias} from './${query.file.replace(/\.ts$/, '.js')}';`);
      }
      impl = `, impl: ${alias}.${query.name} as QueryImpl<QueryShape>`;
      ported++;
    } else {
      missing.push(query);
    }
    entries.push(`  '${query.key}': { source: '${query.file}#${query.name}'${impl} },`);
  }

  const output = [
    '// Generated by scripts/firestore/index-queries.ts. Do not edit.',
    '/* eslint-disable */',
    "import type { QueryImpl, QueryShape } from './run.js';",
    ...imports,
    '',
    'export const QUERIES: Record<string, { source: string; impl?: QueryImpl<QueryShape> }> = {',
    ...entries,
    '};',
    '',
  ].join('\n');

  // Ports that no longer match any query: their SQL changed upstream (or the query was removed).
  const stale: string[] = [];
  for (const file of new Set(queries.map(q => q.file))) {
    const exported = portExports(resolve(portsDir, file));
    const names = new Set(queries.filter(q => q.file === file).map(q => q.name));
    for (const name of exported) if (!names.has(name)) stale.push(`${file}#${name}`);
  }

  if (check) {
    const current = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : '';
    if (current !== output) {
      console.error(
        'firestore query index is stale: run `yarn workspace @accounter/server firestore:queries`',
      );
      process.exit(1);
    }
  } else {
    writeFileSync(indexFile, output);
    const texts = Object.fromEntries(
      [...keys.values()].map(q => [
        q.key,
        { source: `${q.file}#${q.name}`, type: q.type, text: q.text },
      ]),
    );
    writeFileSync(sqlFile, JSON.stringify(texts, null, 1) + '\n');
  }

  const byModule = new Map<string, { total: number; ported: number }>();
  for (const query of keys.values()) {
    const module = query.file.split('/').slice(0, 2).join('/');
    const stats = byModule.get(module) ?? { total: 0, ported: 0 };
    stats.total++;
    if (!missing.includes(query)) stats.ported++;
    byModule.set(module, stats);
  }
  if (process.argv.includes('--verbose')) {
    for (const [module, stats] of [...byModule].sort()) {
      console.log(`${module.padEnd(40)} ${stats.ported}/${stats.total}`);
    }
  }
  if (stale.length) console.log(`stale ports (SQL changed or query removed): ${stale.join(', ')}`);
  console.log(`firestore queries: ${ported}/${keys.size} ported`);
}

main();
