import { readFile, writeFile, mkdir, realpath, stat } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { siteConfig } from '../site.config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const withinRoot = target => {
  const path = relative(root, target);
  return !isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep);
};
const safe = path => {
  const target = resolve(root, path);
  if (target === root || !withinRoot(target)) throw new Error('Output must remain inside the site.');
  return target;
};
if (resolve(process.cwd()).toLowerCase() !== root.toLowerCase()) {
  throw new Error('Run the build from the verified site directory.');
}
if ((await realpath(root)).toLowerCase() !== root.toLowerCase()) {
  throw new Error('The site directory must not redirect writes through a filesystem link.');
}
async function outputDirectory(path) {
  const target = safe(path);
  let parent = target;
  while (true) {
    try { await stat(parent); break; }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      parent = dirname(parent);
    }
  }
  if (!withinRoot(await realpath(parent))) throw new Error('Output directory redirects outside the site.');
  await mkdir(target, { recursive: true });
  if (!withinRoot(await realpath(target))) throw new Error('Output directory redirects outside the site.');
  return target;
}
const temp = await outputDirectory('.agent_tmp');
process.env.TEMP = temp;
process.env.TMP = temp;
const out = await outputDirectory('dist');
const ssr = await outputDirectory('.agent_tmp/ssr');
const cache = await outputDirectory('.agent_cache/vite');

const rawBase = process.env.SITE_BASE || siteConfig.base;
const decodedBase = decodeURIComponent(rawBase);
if (!rawBase.startsWith('/') || /[\\?#\u0000-\u001F]/.test(decodedBase) || decodedBase.split('/').some(part => part === '.' || part === '..')) {
  throw new Error('SITE_BASE must be an absolute URL path without traversal, query or fragment.');
}
const baseParts = rawBase.split('/').filter(Boolean);
const base = baseParts.length ? '/' + baseParts.join('/') + '/' : '/';
const publicUrl = new URL(process.env.SITE_URL || siteConfig.url);
if (!['http:', 'https:'].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash) {
  throw new Error('SITE_URL must be a public HTTP(S) URL without credentials, query or fragment.');
}
const publicPrefix = publicUrl.pathname.replace(/\/+$/, '');
const basePrefix = base.replace(/\/+$/, '');
if (publicPrefix && publicPrefix !== basePrefix) throw new Error('SITE_URL path must match SITE_BASE.');
publicUrl.pathname = base;
const siteUrl = publicUrl.href.replace(/\/$/, '');
process.env.VITE_SITE_URL = siteUrl;
process.env.SITE_BASE = base;

const { build } = await import('vite');
await build({ root, base, cacheDir: cache, build: { outDir: out, emptyOutDir: true } });
await build({
  root, base, cacheDir: cache,
  build: {
    ssr: true, outDir: ssr, emptyOutDir: true,
    rollupOptions: {
      input: { 'entry-server': safe('src/entry-server.tsx'), site: safe('src/site.ts') },
    },
  },
});
const [{ render, catalog }, { pages }] = await Promise.all([
  import(pathToFileURL(resolve(ssr, 'entry-server.js')).href),
  import(pathToFileURL(resolve(ssr, 'site.js')).href),
]);
const template = await readFile(resolve(out, 'index.html'), 'utf8');
await outputDirectory('dist/data');
await writeFile(safe('dist/data/catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
const packageInfo = JSON.parse(await readFile(safe('package.json'), 'utf8'));
await writeFile(safe('dist/build-info.json'), JSON.stringify({ siteVersion: packageInfo.version, catalogVersion: catalog.version, mode: 'curated', scene: 'coastal-realism-v3', presentation: 'city-story-spatial-photo-v2', builtAt: new Date().toISOString(), base }, null, 2) + '\n');
if (!template.includes('<div id="root"></div>')) throw new Error('The static root placeholder is missing.');
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const documentFor = (path, { title, description }, extraMeta = '') => template
  .replace(/<title>.*?<\/title>/, () => '<title>' + escape(title) + '</title>')
  .replace(/<meta name="description" content="[^"]*"\s*\/?>/, () => '<meta name="description" content="' + escape(description) + '"/>')
  .replace('</head>', extraMeta + '</head>')
  .replace('<div id="root"></div>', () => '<div id="root">' + render(path, base) + '</div>');
for (const [path, page] of Object.entries(pages)) {
  const url = siteUrl + path;
  const meta = '<link rel="canonical" href="' + escape(url) + '"/>'
    + '<meta property="og:title" content="' + escape(page.title) + '"/>'
    + '<meta property="og:description" content="' + escape(page.description) + '"/>'
    + '<meta property="og:url" content="' + escape(url) + '"/>'
    + '<meta property="og:type" content="website"/>'
    + '<meta property="og:image" content="' + escape(siteUrl + '/assets/hero.webp') + '"/>'
    + (path === '/' ? '<link rel="preload" as="image" media="(min-width: 900px), (orientation: landscape)" href="' + escape(base + 'assets/hero.webp') + '"/>'
      + '<link rel="preload" as="image" media="(max-width: 899px) and (orientation: portrait)" href="' + escape(base + 'assets/cinematic/hero-mobile.webp') + '"/>' : '');
  const destination = path === '/' ? out : await outputDirectory('dist/' + path.slice(1));
  await writeFile(resolve(destination, 'index.html'), documentFor(path, page, meta));
}
await writeFile(safe('dist/404.html'), documentFor('/not-found/', {
  title: '页面未找到 · 问途 AskWay', description: '回到问途首页，重新找到出发的方向。',
}, '<meta name="robots" content="noindex"/>'));
await writeFile(safe('dist/.nojekyll'), '');
const hostname = publicUrl.hostname;
if (!hostname.endsWith('.github.io') && hostname !== 'localhost' && !/^[\d.]+$/.test(hostname) && !hostname.includes(':')) {
  await writeFile(safe('dist/CNAME'), hostname + '\n');
}
await writeFile(safe('dist/robots.txt'), 'User-agent: *\nAllow: /\nSitemap: ' + siteUrl + '/sitemap.xml\n');
await writeFile(safe('dist/sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  + Object.keys(pages).map(path => '<url><loc>' + escape(siteUrl + path) + '</loc></url>').join('') + '</urlset>');
console.log('Prerendered ' + Object.keys(pages).length + ' pages, 404 and sitemap with base ' + base + '.');
