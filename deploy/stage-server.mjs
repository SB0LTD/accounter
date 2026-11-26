// Prepares deploy/.build/server: the Docker build context for the Accounter API.
//
// Copies the workspace manifests, lockfile and Yarn (so `yarn workspaces focus` can install the
// server's production dependencies), and the prebuilt dist output of the server and the workspace
// packages it imports. Run after building them (deploy/deploy-server.sh does both).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'deploy', '.build', 'server');

/** Workspace packages the server imports at run time; their dist output ships. */
const RUNTIME_PACKAGES = [
  'server',
  'green-invoice-graphql',
  'opcn1214-generator',
  'pcn874-generator',
  'shaam-uniform-format-generator',
  'shaam6111-generator',
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const file of ['package.json', 'yarn.lock', '.yarnrc.yml']) {
  cpSync(join(root, file), join(out, file));
}
cpSync(join(root, '.yarn', 'releases'), join(out, '.yarn', 'releases'), { recursive: true });
if (existsSync(join(root, '.yarn', 'patches'))) {
  cpSync(join(root, '.yarn', 'patches'), join(out, '.yarn', 'patches'), { recursive: true });
}

// Every workspace manifest, so Yarn sees the same project the lockfile describes.
const rootManifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const excluded = new Set(
  rootManifest.workspaces.packages.filter(p => p.startsWith('!')).map(p => p.slice(1)),
);
for (const name of readdirSync(join(root, 'packages'))) {
  const manifest = join(root, 'packages', name, 'package.json');
  if (excluded.has(`packages/${name}`) || !existsSync(manifest)) continue;
  mkdirSync(join(out, 'packages', name), { recursive: true });
  cpSync(manifest, join(out, 'packages', name, 'package.json'));
}

for (const name of RUNTIME_PACKAGES) {
  const dist = join(root, 'packages', name, 'dist');
  if (!existsSync(dist)) throw new Error(`packages/${name}/dist is missing: build it first`);
  cpSync(dist, join(out, 'packages', name, 'dist'), {
    recursive: true,
    filter: source => !source.endsWith('.tsbuildinfo') && !source.endsWith('.map'),
  });
}

cpSync(join(root, 'deploy', 'server', 'Dockerfile'), join(out, 'Dockerfile'));
console.log(`staged ${out}`);
