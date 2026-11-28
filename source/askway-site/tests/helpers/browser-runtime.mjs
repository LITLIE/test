import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { storyChapters } from '../../src/features/cinematic/storyConfig.ts';

export const storySampleProgress = Object.fromEntries(storyChapters.map(chapter => [chapter.phase, chapter.progress]));

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const realProjectRoot = realpathSync(projectRoot);
const contained = (root, path) => {
  const part = relative(root, path);
  return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith('..' + sep));
};
const realWorkspaceRoot = realpathSync(resolve(projectRoot, '../../..'));
if (!contained(realWorkspaceRoot, realProjectRoot)) throw new Error('The project real path escaped the workspace');

// Lexical checks miss linked existing ancestors of files not yet created.
export function insideProject(path) {
  const result = resolve(projectRoot, path);
  if (!contained(projectRoot, result)) throw new Error('Test output escaped the project: ' + path);
  if (realpathSync(projectRoot) !== realProjectRoot) throw new Error('The project root changed its real path');
  let ancestor = projectRoot;
  for (const part of relative(projectRoot, result).split(sep).filter(Boolean)) {
    ancestor = resolve(ancestor, part);
    try { lstatSync(ancestor); }
    catch (error) { if (error.code === 'ENOENT') break; throw error; }
    if (!contained(realProjectRoot, realpathSync(ancestor))) throw new Error('Test output has an ancestor outside the project: ' + ancestor);
  }
  return result;
}

export const testBase = (process.env.TEST_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
export async function captureBrowserBuild(base = testBase) {
  const response = await fetch(base + '/');
  if (!response.ok) throw new Error('Cannot capture the tested build: HTTP ' + response.status);
  const served = await response.text();
  const digest = value => createHash('sha256').update(value).digest('hex');
  const files = ['package.json', 'dist/index.html',
    'src/pages/Home.tsx', 'src/features/cinematic/StoryStage.tsx',
    'src/features/cinematic/useStoryProgress.ts', 'src/features/cinematic/progress.ts',
    'src/features/cinematic/cinematic.css', 'src/components/SeaRouteParticles.tsx',
    'src/motion/PresentationMotion.tsx', 'src/components/SiteHeader.tsx', 'src/features/experience/ui/ExperiencePreview.tsx',
    'src/features/experience/ui/JourneyPreview.tsx', 'src/features/experience/ui/JourneyPreview.css'];
  for (const match of served.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
    files.push('dist/assets/' + new URL(match[1], base).pathname.split('/').at(-1));
  }
  const hashes = Object.fromEntries(await Promise.all([...new Set(files)].map(async path => [path, digest(await readFile(insideProject(path)))])));
  return { measuredAt: new Date().toISOString(), base, servedHomeSha256: digest(served), servedMatchesLocalDist: digest(served) === hashes['dist/index.html'], hashes };
}
function localEnvironment(directory, cache) {
  return {
    TEMP: directory, TMP: directory, TMPDIR: directory,
    APPDATA: insideProject(directory + '/appdata'),
    LOCALAPPDATA: insideProject(directory + '/localappdata'),
    XDG_CONFIG_HOME: insideProject(cache + '/config'), XDG_CACHE_HOME: cache,
    npm_config_cache: insideProject(cache + '/npm'),
  };
}
// Redirect before Playwright imports. Assigning variables creates no files.
Object.assign(process.env, localEnvironment(insideProject('.agent_tmp/browser-runtime/environment'), insideProject('.agent_cache/browser/environment')));

export async function createBrowserContext(name, options = {}) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) throw new Error('Invalid browser profile name');
  const directory = insideProject('.agent_tmp/browser-runtime/' + name);
  const cache = insideProject('.agent_cache/browser/' + name);
  const environment = localEnvironment(directory, cache);
  const launchOptions = { ...options };
  for (const key of ['downloadsPath', 'tracesDir']) launchOptions[key] = insideProject(options[key] || directory + '/' + (key === 'downloadsPath' ? 'downloads' : 'traces'));
  if (options.recordVideo) launchOptions.recordVideo = { ...options.recordVideo, dir: insideProject(options.recordVideo.dir) };
  if (options.recordHar) launchOptions.recordHar = { ...options.recordHar, path: insideProject(options.recordHar.path) };
  for (const arg of options.args || []) {
    if (/^--(?:user-data-dir|disk-cache-dir|crash-dumps-dir|data-path|log-file)(?:=|$)/i.test(arg)) throw new Error('Browser arguments cannot override confined output paths: ' + arg);
  }
  for (const path of new Set([directory, cache, ...Object.values(environment), directory + '/crashes', launchOptions.downloadsPath, launchOptions.tracesDir, options.recordVideo && launchOptions.recordVideo.dir].filter(Boolean))) {
    await mkdir(insideProject(path), { recursive: true });
    insideProject(path);
  }
  Object.assign(process.env, environment);
  const { chromium } = await import('playwright-core');
  return chromium.launchPersistentContext(insideProject(directory + '/profile'), {
    executablePath: process.env.TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce',
    ...launchOptions, env: { ...process.env, ...environment },
    args: [
      '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--disable-component-update', '--disable-domain-reliability', '--disable-sync',
      '--disable-breakpad', '--disable-crash-reporter', '--disable-features=msEdgeSidebarV2,msEdgeShopping,msImplicitSignin',
      '--crash-dumps-dir=' + insideProject(directory + '/crashes'), '--disk-cache-dir=' + cache,
      ...(options.args || []),
    ],
  });
}

export async function scrollStoryToProgress(page, progress) {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) throw new Error('Expected story progress in [0, 1]');
  await page.waitForFunction(() => document.querySelector('.cinematic-story')?.dataset.storyLayout === 'sticky');
  await page.evaluate(progress => {
    const story = document.querySelector('.cinematic-story');
    const viewport = story?.querySelector('.story-viewport');
    if (!story || !viewport) throw new Error('The cinematic story and viewport must exist');
    const geometry = story.getBoundingClientRect();
    const start = geometry.top + scrollY;
    const distance = Math.max(geometry.height - viewport.getBoundingClientRect().height, 1);
    window.scrollTo({ top: start + distance * progress, behavior: 'instant' });
  }, progress);
  await page.waitForFunction(expected => {
    const value = document.querySelector('.cinematic-story')?.getAttribute('data-story-progress');
    return value !== null && value !== undefined && Math.abs(Number(value) - expected) < .015;
  }, progress);
}

export async function storyRuntime(page) {
  return page.locator('.cinematic-story').evaluate(story => {
    const metric = name => {
      const raw = story.getAttribute(name);
      if (raw === null || !Number.isFinite(Number(raw))) throw new Error('Missing finite story metric: ' + name);
      return Number(raw);
    };
    return { progress: metric('data-story-progress'), drawCount: metric('data-story-draw-count'), activeTime: metric('data-story-active-time'), phase: story.dataset.storyPhase, layout: story.dataset.storyLayout };
  });
}

export async function settlePresentation(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(100);
}
