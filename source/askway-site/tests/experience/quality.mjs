import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { createBrowserContext, insideProject, projectRoot, testBase } from '../helpers/browser-runtime.mjs';

// This runner uses installed libraries and the existing Edge executable. It never
// installs packages, downloads a browser, or invokes package lifecycle scripts.
const output = insideProject(process.env.QUALITY_OUTDIR || 'delivery/quality');
const runId = `${Date.now()}-${process.pid}`;
const environmentRoot = insideProject('.agent_tmp/quality/environment');
const environmentCache = insideProject('.agent_cache/quality/environment');
for (const directory of [output, environmentRoot, environmentCache, join(environmentRoot, 'appdata'), join(environmentRoot, 'localappdata'), join(environmentCache, 'config')]) {
  await mkdir(directory, { recursive: true });
}
Object.assign(process.env, {
  TEMP: environmentRoot,
  TMP: environmentRoot,
  APPDATA: join(environmentRoot, 'appdata'),
  LOCALAPPDATA: join(environmentRoot, 'localappdata'),
  XDG_CONFIG_HOME: join(environmentCache, 'config'),
  XDG_CACHE_HOME: environmentCache,
  npm_config_cache: join(environmentCache, 'npm'),
});

const args = new Set(process.argv.slice(2));
const runAxe = !args.has('--lighthouse-only');
const runLighthouse = !args.has('--axe-only');
if (!runAxe && !runLighthouse) throw new Error('Choose at least one quality stage');
const packageJson = JSON.parse(await readFile(insideProject('package.json'), 'utf8'));
const documentResponse = await fetch(`${testBase}/`);
if (!documentResponse.ok) throw new Error(`Quality server returned ${documentResponse.status}`);
const homeHtml = await documentResponse.text();
const metadata = {
  measuredAt: new Date().toISOString(),
  baseUrl: testBase,
  siteVersion: packageJson.version,
  homeDocumentSha256: createHash('sha256').update(homeHtml).digest('hex'),
  entryScripts: [...homeHtml.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]),
  nodeVersion: process.version,
  browserPath: process.env.TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  outputDirectory: relative(projectRoot, output).replaceAll('\\', '/'),
  writesConfinedToProject: true,
  packageLifecycleScriptsInvoked: false,
};
const routes = [
  { name: 'home', path: '/' },
  { name: 'product', path: '/product/' },
  { name: 'experience', path: '/experience/' },
  { name: 'cooperation', path: '/cooperation/' },
  { name: 'about', path: '/about/' },
];
const viewports = [
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1440, height: 1000, isMobile: false, hasTouch: false },
];
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const limitations = [
  'axe-core scans automatically test applicable WCAG 2.2 A/AA rules; zero violations does not establish full WCAG conformance.',
  'Incomplete axe results need manual review. Keyboard usability, meaningful reading order, zoom, screen readers, and real touch use require separate review.',
  'Screenshots use local headless Edge screen simulation at 390×844 and 1440×1000 CSS pixels; they are not real-device tests.',
  '44×44 CSS pixels is a touch-usability recommendation; the WCAG 2.2 AA target-size minimum is 24×24 with specified exceptions.',
  'Lighthouse performance uses a local build and simulated mobile CPU/network throttling. LCP/CLS/TBT are lab results, not field Core Web Vitals or measured real-device INP.',
  'The current build is measured directly. Historical baseline scores are not used as current results.',
];
const accessibility = [];
const screenshots = [];
const errors = [];
const performance = [];
let browserReleaseUnconfirmed = false;

function artifactPath(name) {
  return insideProject(`${relative(projectRoot, output)}/${name}`);
}
async function saveJson(name, value) {
  await writeFile(artifactPath(name), JSON.stringify(value, null, 2) + '\n', 'utf8');
}
async function removeProjectDirectory(path) {
  await rm(insideProject(path), { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}
async function releaseLighthouseBrowser(chrome, chromeLauncher, profileDirectory) {
  if (!chrome) {
    // launch() registers its instance before it awaits the debugging port. A
    // rejected launch can therefore have an Edge child without returning it.
    let pid = null;
    try {
      const value = (await readFile(insideProject(join(profileDirectory, 'chrome.pid')), 'utf8')).trim();
      if (/^[1-9]\d*$/.test(value)) pid = Number(value);
    } catch {}
    const failures = chromeLauncher.killAll();
    if (failures.length) throw new Error(failures.map(error => error.message).join('; '));
    if (pid) {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        try { process.kill(pid, 0); }
        catch (error) {
          if (error.code === 'ESRCH') return { launchCompleted: false, pid, processLocalCleanupAttempted: true, processExitConfirmed: true };
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`Edge process ${pid} remains after a failed launch cleanup`);
    }
    return { launchCompleted: false, processLocalCleanupAttempted: true, processExitConfirmed: false, pidWasRecorded: false };
  }
  const child = chrome.process;
  let timer;
  let onClose;
  const closed = child.exitCode !== null || child.signalCode !== null
    ? Promise.resolve({ pid: child.pid, closed: true, exitCode: child.exitCode, signal: child.signalCode })
    : new Promise((resolve, reject) => {
      onClose = (exitCode, signal) => resolve({ pid: child.pid, closed: true, exitCode, signal });
      child.once('close', onClose);
      timer = setTimeout(() => reject(new Error(`Edge process ${child.pid} did not close after Lighthouse cleanup`)), 10000);
    });
  try {
    chrome.kill();
    return await closed;
  } finally {
    clearTimeout(timer);
    if (onClose) child.off('close', onClose);
  }
}
async function readyForScreenshot(page) {
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function capture(page, route, viewport, state) {
  const prefix = `${route.name}-${viewport.name}${state === 'initial' ? '' : `-${state}`}`;
  const full = `${prefix}-full.png`;
  const first = `${prefix}-first.png`;
  await readyForScreenshot(page);
  await page.screenshot({ path: artifactPath(full), fullPage: true, animations: 'disabled' });
  await readyForScreenshot(page);
  await page.screenshot({ path: artifactPath(first), fullPage: false, animations: 'disabled' });
  screenshots.push({ route: route.path, viewport, state, fullPage: full, firstViewport: first });
}
async function renderedChecks(page) {
  return page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !element.closest('[inert],[aria-hidden="true"]');
    };
    const description = element => ({
      selector: element.id ? `#${element.id}` : element.tagName.toLowerCase() + [...element.classList].map(name => `.${name}`).join(''),
      text: (element.getAttribute('aria-label') || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
      fontSizePx: Number.parseFloat(getComputedStyle(element).fontSize),
    });
    const editable = [...document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea')]
      .filter(visible).map(element => ({ ...description(element), type: element.type || element.tagName.toLowerCase(), fontSizePx: Number.parseFloat(getComputedStyle(element).fontSize) }));
    const reading = [...document.querySelectorAll('main p, main dd, main .task-copy > span, main .task-copy > small')]
      .filter(visible).filter(element => element.textContent.trim().length > 12).map(description);
    const compactTargets = [...document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary')]
      .filter(visible).map(element => {
        const label = element.matches('input[type="checkbox"],input[type="radio"]') ? element.labels?.[0] : null;
        const target = label && visible(label) ? label : element;
        const rect = target.getBoundingClientRect();
        return { ...description(element), effectiveTarget: label ? 'associated clickable label' : 'element', widthPx: Math.round(rect.width * 10) / 10, heightPx: Math.round(rect.height * 10) / 10 };
      }).filter(target => target.widthPx < 44 || target.heightPx < 44);
    const taskText = [...document.querySelectorAll('.task-copy > span, .task-copy > small')].filter(visible).map(description);
    return {
      documentWidthPx: document.documentElement.scrollWidth,
      viewportWidthPx: window.innerWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      h1Count: document.querySelectorAll('h1').length,
      mainCount: document.querySelectorAll('main').length,
      editableControls: editable,
      editableControlsBelow16Px: editable.filter(control => control.fontSizePx < 16),
      readingTextBelow14Px: reading.filter(text => text.fontSizePx < 14),
      compactTouchTargetsBelow44Px: compactTargets,
      taskText,
      userAgent: navigator.userAgent,
    };
  });
}
async function scan(page, route, viewport, state, pageErrors) {
  await readyForScreenshot(page);
  const result = await page.evaluate(async tags => window.axe.run(document, {
    runOnly: { type: 'tag', values: tags },
    resultTypes: ['violations', 'incomplete', 'passes', 'inapplicable'],
  }), wcagTags);
  const fileName = `axe-${route.name}-${viewport.name}-${state}.json`;
  await saveJson(fileName, result);
  const checks = await renderedChecks(page);
  const summary = {
    route: route.path, viewport, state,
    axeVersion: result.testEngine.version,
    report: fileName,
    violations: result.violations.map(item => ({
      id: item.id, impact: item.impact, help: item.help, helpUrl: item.helpUrl,
      affectedNodes: item.nodes.length,
      nodes: item.nodes.map(node => ({ target: node.target, html: node.html, failureSummary: node.failureSummary })),
    })),
    incomplete: result.incomplete.map(item => ({ id: item.id, help: item.help, nodes: item.nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary })) })),
    passes: result.passes.length,
    inapplicable: result.inapplicable.length,
    pageErrors: [...pageErrors],
    renderedChecks: checks,
  };
  accessibility.push(summary);
  console.log(JSON.stringify({ stage: 'axe', route: route.path, width: viewport.width, state, violations: summary.violations.length, affectedNodes: summary.violations.reduce((sum, item) => sum + item.affectedNodes, 0), incomplete: summary.incomplete.length, horizontalOverflow: checks.horizontalOverflow, inputsBelow16Px: checks.editableControlsBelow16Px.length, readingTextBelow14Px: checks.readingTextBelow14Px.length }));
  await capture(page, route, viewport, state);
}

async function accessibilityStage() {
  for (const viewport of viewports) {
    const profileName = `quality-axe-${viewport.name}-${runId}`;
    let context;
    try {
      context = await createBrowserContext(profileName, {
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile, hasTouch: viewport.hasTouch, deviceScaleFactor: 1,
        args: ['--disable-default-apps', '--disable-extensions', '--no-service-autorun', '--metrics-recording-only', '--password-store=basic'],
      });
      metadata.browserVersion ||= context.browser()?.version() || null;
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      for (const route of routes) {
        const pageErrors = [];
        const onError = error => pageErrors.push(error.message);
        page.on('pageerror', onError);
        try {
          const response = await page.goto(testBase + route.path, { waitUntil: 'networkidle', timeout: 45000 });
          if (!response?.ok()) throw new Error(`Route returned HTTP ${response?.status()}`);
          await page.evaluate(() => document.fonts.ready);
          await page.addScriptTag({ path: insideProject('node_modules/axe-core/axe.min.js') });
          await scan(page, route, viewport, 'initial', pageErrors);
          if (route.name === 'experience') {
            await page.getByRole('button', { name: '核对并确认条件', exact: true }).click();
            await page.getByRole('button', { name: '生成旅程候选', exact: true }).click();
            await page.locator('[data-proposal]').waitFor({ state: 'visible' });
            await scan(page, route, viewport, 'candidate', pageErrors);
            if (viewport.isMobile) await page.locator('.mobile-panel-nav').getByRole('button', { name: '地图', exact: true }).click();
            await page.getByRole('button', { name: '查看地点依据', exact: true }).click();
            await page.locator('[data-place-details]').waitFor({ state: 'visible' });
            await scan(page, route, viewport, 'evidence', pageErrors);
          }
        } catch (error) {
          errors.push({ stage: 'axe', route: route.path, viewport: viewport.name, message: error.message });
          console.error(JSON.stringify(errors.at(-1)));
        } finally {
          page.off('pageerror', onError);
        }
      }
    } catch (error) {
      errors.push({ stage: 'axe', operation: 'browser-session', viewport: viewport.name, message: error.message });
    } finally {
      let closed = !context;
      try { if (context) { await context.close(); closed = true; } }
      catch (error) {
        browserReleaseUnconfirmed = true;
        errors.push({ stage: 'axe', operation: 'browser-cleanup', viewport: viewport.name, message: error.message });
      }
      if (closed) {
        for (const path of [`.agent_tmp/browser-runtime/${profileName}`, `.agent_cache/browser/${profileName}`]) {
          try { await removeProjectDirectory(path); }
          catch (error) { errors.push({ stage: 'axe', operation: 'directory-cleanup', viewport: viewport.name, message: error.message }); }
        }
      }
    }
    if (browserReleaseUnconfirmed) break;
  }
  await saveJson('accessibility-summary.json', { metadata, wcagTags, limitations, scans: accessibility, screenshots, errors: errors.filter(item => item.stage === 'axe') });
  await saveJson('screenshots.json', { metadata, screenshots });
}

async function lighthouseStage() {
  // The Playwright helper changes the current process's TEMP/TMP. Its profiles
  // have been removed by this stage, so restore an existing in-project location.
  process.env.TEMP = environmentRoot;
  process.env.TMP = environmentRoot;
  const [{ default: lighthouse }, chromeLauncher] = await Promise.all([import('lighthouse'), import('chrome-launcher')]);
  for (const route of routes.filter(item => ['home', 'experience'].includes(item.name))) {
    const runtime = insideProject(`.agent_tmp/quality/lighthouse-${route.name}-${runId}`);
    const cache = insideProject(`.agent_cache/quality/lighthouse-${route.name}-${runId}`);
    for (const directory of [runtime, cache, join(runtime, 'profile'), join(runtime, 'appdata'), join(runtime, 'localappdata'), join(runtime, 'crashes')]) await mkdir(directory, { recursive: true });
    const scopedEnvironment = {
      ...process.env,
      TEMP: runtime, TMP: runtime,
      APPDATA: join(runtime, 'appdata'), LOCALAPPDATA: join(runtime, 'localappdata'),
      XDG_CONFIG_HOME: join(environmentCache, 'config'), XDG_CACHE_HOME: cache,
    };
    let chrome;
    let releaseFailed = false;
    try {
      chrome = await chromeLauncher.launch({
        chromePath: metadata.browserPath,
        userDataDir: join(runtime, 'profile'),
        envVars: scopedEnvironment,
        logLevel: 'silent', handleSIGINT: true,
        chromeFlags: [
          '--headless=new', '--no-first-run', '--no-default-browser-check', '--no-service-autorun',
          '--disable-background-networking', '--disable-component-update', '--disable-domain-reliability',
          '--disable-sync', '--disable-default-apps', '--disable-extensions', '--disable-client-side-phishing-detection',
          '--disable-breakpad', '--disable-crash-reporter', '--metrics-recording-only', '--password-store=basic',
          '--disable-features=msEdgeSidebarV2,msEdgeShopping,msImplicitSignin,msEdgeSignin,MediaRouter,OptimizationHints',
          `--crash-dumps-dir=${join(runtime, 'crashes')}`, `--disk-cache-dir=${cache}`,
        ],
      });
      const result = await lighthouse(testBase + route.path, {
        port: chrome.port, hostname: '127.0.0.1', logLevel: 'error',
        output: ['json', 'html'],
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        formFactor: 'mobile', throttlingMethod: 'simulate',
        screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1, disabled: false },
        locale: 'zh-CN', maxWaitForLoad: 45000,
      });
      if (!result?.lhr) throw new Error('Lighthouse returned no report');
      const lhr = result.lhr;
      const prefix = `lighthouse-${route.name}-mobile`;
      await saveJson(`${prefix}.json`, lhr);
      const html = Array.isArray(result.report) ? result.report[1] : result.report;
      await writeFile(artifactPath(`${prefix}.html`), html, 'utf8');
      const score = name => lhr.categories[name]?.score == null ? null : Math.round(lhr.categories[name].score * 100);
      const metric = name => ({ numericValue: lhr.audits[name]?.numericValue ?? null, displayValue: lhr.audits[name]?.displayValue ?? null, score: lhr.audits[name]?.score ?? null });
      const summary = {
        route: route.path, measuredAt: lhr.fetchTime, lighthouseVersion: lhr.lighthouseVersion,
        reportJson: `${prefix}.json`, reportHtml: `${prefix}.html`,
        scores: { performance: score('performance'), accessibility: score('accessibility'), bestPractices: score('best-practices'), seo: score('seo') },
        metrics: { lcp: metric('largest-contentful-paint'), cls: metric('cumulative-layout-shift'), tbt: metric('total-blocking-time'), fcp: metric('first-contentful-paint'), speedIndex: metric('speed-index') },
        settings: lhr.configSettings, environment: lhr.environment,
        runtimeError: lhr.runtimeError || null,
        runWarnings: lhr.runWarnings,
        failedAudits: Object.values(lhr.audits).filter(audit => audit.score !== null && audit.score < 1 && !['notApplicable', 'manual', 'informative'].includes(audit.scoreDisplayMode)).map(audit => ({ id: audit.id, title: audit.title, score: audit.score, displayValue: audit.displayValue, description: audit.description })),
      };
      performance.push(summary);
      console.log(JSON.stringify({ stage: 'lighthouse', route: route.path, ...summary.scores, lcp: summary.metrics.lcp.numericValue, cls: summary.metrics.cls.numericValue, tbt: summary.metrics.tbt.numericValue, runtimeError: summary.runtimeError }));
    } catch (error) {
      errors.push({ stage: 'lighthouse', route: route.path, message: error.message });
      console.error(JSON.stringify(errors.at(-1)));
    } finally {
      let processExitConfirmed = false;
      try {
        const release = await releaseLighthouseBrowser(chrome, chromeLauncher, join(runtime, 'profile'));
        processExitConfirmed = release.closed || release.processExitConfirmed;
        const measured = performance.find(run => run.route === route.path);
        if (measured) measured.browserProcessRelease = release;
        if (!processExitConfirmed) {
          releaseFailed = true;
          errors.push({ stage: 'lighthouse', operation: 'browser-cleanup', route: route.path, message: 'Failed launch cleanup was attempted without a recorded PID; runtime directories retained.' });
        }
      } catch (error) {
        releaseFailed = true;
        errors.push({ stage: 'lighthouse', operation: 'browser-cleanup', route: route.path, message: error.message });
      }
      if (processExitConfirmed) {
        for (const directory of [runtime, cache]) {
          try { await removeProjectDirectory(relative(projectRoot, directory)); }
          catch (error) { errors.push({ stage: 'lighthouse', operation: 'directory-cleanup', route: route.path, message: error.message }); }
        }
      }
    }
    if (releaseFailed) break;
  }
  await saveJson('lighthouse-summary.json', { metadata, limitations, runs: performance, errors: errors.filter(item => item.stage === 'lighthouse') });
}

if (runAxe) await accessibilityStage();
if (runLighthouse && !browserReleaseUnconfirmed) await lighthouseStage();
if (runLighthouse && browserReleaseUnconfirmed) {
  errors.push({ stage: 'lighthouse', operation: 'stage-skipped', message: 'An accessibility browser exit was not confirmed; performance measurement skipped.' });
  await saveJson('lighthouse-summary.json', { metadata, limitations, runs: [], errors: errors.filter(item => item.stage === 'lighthouse') });
}
const existing = async name => {
  try { return JSON.parse(await readFile(artifactPath(name), 'utf8')); }
  catch { return null; }
};
const axeReport = await existing('accessibility-summary.json');
const lighthouseReport = await existing('lighthouse-summary.json');
const matchesBuild = report => report?.metadata.homeDocumentSha256 === metadata.homeDocumentSha256 && report?.metadata.baseUrl === metadata.baseUrl;
const stageStatus = (report, expected) => {
  if (!report) return 'not_measured';
  if (!matchesBuild(report)) return 'stale_build';
  if (report.errors?.length) return 'measurement_failed';
  if ((report.scans || report.runs || []).length !== expected) return 'measurement_incomplete';
  return 'available';
};
await saveJson('quality-report.json', {
  metadata, limitations,
  accessibility: matchesBuild(axeReport) ? axeReport : null,
  lighthouse: matchesBuild(lighthouseReport) ? lighthouseReport : null,
  stageStatus: {
    accessibility: stageStatus(axeReport, 14),
    lighthouse: stageStatus(lighthouseReport, 2),
  },
});
const scanFailures = accessibility.some(scan => scan.violations.length || scan.pageErrors.length || scan.renderedChecks.horizontalOverflow || scan.renderedChecks.editableControlsBelow16Px.length);
const lighthouseFailures = performance.some(run => run.runtimeError);
process.exitCode = errors.length || scanFailures || lighthouseFailures ? 1 : 0;
console.log(JSON.stringify({ stage: 'complete', scans: accessibility.length, screenshotStates: screenshots.length, screenshotFiles: screenshots.length * 2, lighthouseRuns: performance.length, errors: errors.length, exitCode: process.exitCode, report: artifactPath('quality-report.json') }));
