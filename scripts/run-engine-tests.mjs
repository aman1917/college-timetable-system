/**
 * Runs the engine test suite with zero dependencies.
 *
 * Next.js source uses extensionless relative imports ("./domain"), which is
 * idiomatic and what the bundler expects — but Node's ESM loader requires an
 * explicit extension. Rather than uglify the source to suit the test runner,
 * this copies src/lib + scripts into a temp folder and appends ".ts" to
 * relative specifiers, then runs the suite with Node's built-in type stripping.
 *
 * Result: the tests exercise the REAL engine files, and you need no
 * node_modules to run them — useful in CI before `npm install` has happened.
 *
 *   node scripts/run-engine-tests.mjs
 */

import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = path.join(root, '.engine-test-build');

/** Append .ts to relative import/export specifiers that lack an extension. */
function addExtensions(code) {
  return code.replace(
    /(\bfrom\s+|\bimport\s*\()(['"])(\.\.?\/[^'"]*?)\2/g,
    (match, prefix, quote, spec) => {
      if (/\.(ts|tsx|js|mjs|json)$/.test(spec)) return match;
      return `${prefix}${quote}${spec}.ts${quote}`;
    },
  );
}

async function processDir(srcDir, outDir) {
  await mkdir(outDir, { recursive: true });
  for (const entry of await readdir(srcDir, { withFileTypes: true })) {
    const from = path.join(srcDir, entry.name);
    const to = path.join(outDir, entry.name);
    if (entry.isDirectory()) {
      await processDir(from, to);
    } else if (/\.tsx?$/.test(entry.name)) {
      await writeFile(to, addExtensions(await readFile(from, 'utf8')));
    } else {
      await cp(from, to);
    }
  }
}

await rm(tmp, { recursive: true, force: true });
await processDir(path.join(root, 'src', 'lib'), path.join(tmp, 'src', 'lib'));
await processDir(path.join(root, 'scripts'), path.join(tmp, 'scripts'));

const child = spawn(
  process.execPath,
  ['--experimental-strip-types', '--no-warnings', path.join(tmp, 'scripts', 'engine.test.ts')],
  { stdio: 'inherit' },
);

child.on('exit', async (code) => {
  await rm(tmp, { recursive: true, force: true });
  process.exit(code ?? 1);
});
