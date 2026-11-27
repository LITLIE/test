import { cp, lstat, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(siteRoot, '../..');
const output = resolve(siteRoot, 'dist');
if (resolve(process.cwd()).toLowerCase() !== siteRoot.toLowerCase()) throw new Error('Run this command from source/askway-site.');
for (const path of [siteRoot, repoRoot, output]) {
  if ((await realpath(path)).toLowerCase() !== path.toLowerCase()) throw new Error('Publication paths must not redirect through filesystem links.');
}
if (!(await lstat(resolve(repoRoot, '.git'))).isDirectory()) throw new Error('The destination must be this website repository.');

async function rejectLinks(path) {
  let info;
  try { info = await lstat(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (info.isSymbolicLink()) throw new Error(`Refusing a linked publication target: ${path}`);
  if (info.isDirectory()) for (const entry of await readdir(path)) await rejectLinks(resolve(path, entry));
}

const entries = ['index.html', '404.html', '.nojekyll', 'CNAME', 'build-info.json', 'robots.txt', 'sitemap.xml', 'asset-credits.json', 'assets', 'data', 'about', 'product', 'cooperation', 'experience'];
for (const entry of entries) {
  await rejectLinks(resolve(output, entry));
  await rejectLinks(resolve(repoRoot, entry));
}
// Remove only superseded JS/CSS bundles. Photographs, licences and other assets are retained.
const emittedAssets = new Set(await readdir(resolve(output, 'assets')));
for (const name of await readdir(resolve(repoRoot, 'assets'))) {
  if (['.js', '.css'].includes(extname(name)) && !emittedAssets.has(name)) await rm(resolve(repoRoot, 'assets', name));
}
for (const entry of entries) {
  try { await lstat(resolve(output, entry)); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  await cp(resolve(output, entry), resolve(repoRoot, entry), { recursive: true, force: true, dereference: false });
}
const sha = buffer => createHash('sha256').update(buffer).digest('hex');
const index = await readFile(resolve(repoRoot, 'index.html'));
if (sha(index) !== sha(await readFile(resolve(output, 'index.html')))) throw new Error('The publication did not match the built homepage.');
console.log(JSON.stringify({ destination: repoRoot, entries: entries.length, homepageSha256: sha(index), build: JSON.parse(await readFile(resolve(output, 'build-info.json'), 'utf8')) }, null, 2));
