import { mkdir } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export function insideProject(path) {
  const result = resolve(projectRoot, path);
  if (result !== projectRoot && !result.startsWith(projectRoot + sep)) throw new Error('Test output escaped the project');
  return result;
}
export const testBase = (process.env.TEST_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
export async function createBrowserContext(name, options = {}) {
  const directory = insideProject('.agent_tmp/browser-runtime/' + name);
  const cache = insideProject('.agent_cache/browser/' + name);
  for (const path of [directory, cache, directory + '/appdata', directory + '/localappdata', directory + '/crashes']) await mkdir(path, { recursive: true });
  const browserEnvironment = {
    ...process.env,
    TEMP: directory,
    TMP: directory,
    APPDATA: directory + '/appdata',
    LOCALAPPDATA: directory + '/localappdata',
  };
  process.env.TEMP = directory;
  process.env.TMP = directory;
  const { chromium } = await import('playwright-core');
  return chromium.launchPersistentContext(directory + '/profile', {
    executablePath: process.env.TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    ...options,
    env: browserEnvironment,
    args: [
      '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--disable-component-update', '--disable-domain-reliability', '--disable-sync',
      '--disable-breakpad', '--disable-crash-reporter', '--disable-features=msEdgeSidebarV2,msEdgeShopping,msImplicitSignin',
      '--crash-dumps-dir=' + directory + '/crashes', '--disk-cache-dir=' + cache,
      ...(options.args || []),
    ],
  });
}
