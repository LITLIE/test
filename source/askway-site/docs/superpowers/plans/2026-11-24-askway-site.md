# AskWay Official Site Implementation Plan

> **For agentic workers:** Use the executing-plans workflow task by task; preserve the current workspace filesystem boundary. An independent final reviewer is required by requesting-code-review.

**Goal:** Deliver a locally runnable, statically prerendered four-page AskWay brand website with immersive motion and working public interactions.

**Architecture:** A self-contained React site inside the current visualization workspace. Server rendering produces each page's HTML; the browser hydrates it and loads motion progressively. No existing AskWay backend state is initialized.

**Tech Stack:** React 18.3.1, Vite 5.4.21, TypeScript 5.5.4, GSAP 3.15.1, React Router 6.26.2, CSS design tokens, Lucide SVG icons.

**Spec:** docs/design/问途官网_沉浸动效补充方案.md and docs/design/官网前端规划.md.

## Global Constraints

- All writes, dependencies, browser profiles, screenshots, assets and build outputs stay inside the current workspace.
- The existing D: project is read-only this turn; the new deliverable is askway-site/ inside the current workspace.
- Four routes: /, /product/, /cooperation/, /about/; each has real static content and page metadata.
- Primary purpose: brand identity and cooperation value; scope is represented accurately.
- Preserve native scroll; use one sticky product narrative; support reduced motion and small screens.
- Unknown contact channels are not invented. The cooperation tool creates and copies a real local proposal; it never claims transmission.
- Dependencies install with lifecycle scripts disabled and workspace-specific cache/TEMP/TMP.
- Reuse the approved brand colors; use editorial spacing, self-hosted images and traced asset licenses.

## Task 1: Interaction contracts and project runtime

Files: package.json, src/lib/brief.mjs, src/lib/journey.mjs, tests/unit.test.mjs, vite.config.ts, tsconfig.json.

- [x] Write the real proposal and journey-state behavior tests.
- [x] Run node --test tests/unit.test.mjs; confirm expected failures against the initial stubs.
- [x] Implement createPartnershipBrief(input) -> {ok, errors, text} with required organization/details, known focus and length limits.
- [x] Implement stepFromProgress(progress) -> 0..3 with overshoot/NaN handling.
- [x] Run the six tests and typecheck before integrating their consumers.
- [x] Install pinned dependencies using --ignore-scripts, workspace cache, local TEMP/TMP and no browser download.

## Task 2: Four-page site and static export

Files: src/App.tsx, src/main.tsx, src/entry-server.tsx, src/components/, src/pages/, src/styles/, scripts/build.mjs, scripts/serve.mjs.

- [x] Build the shared navigation, responsive menu, footer and accessible route handling.
- [x] Build Home, Product, Cooperation and About with accurate content and useful interactions.
- [x] Connect the form to createPartnershipBrief; retain field errors and expose a readable result.
- [x] Generate static HTML and unique title/description for each route; export a real 404 page and sitemap template.
- [x] Run typecheck/build, then verify direct access, reload, route navigation and static HTML with JavaScript disabled.

## Task 3: Immersive scenes and asset quality

Files: src/components/JourneyStage.tsx, src/hooks/useMotion.ts, src/styles/motion.css, public/assets/, public/asset-credits.json.

- [x] Source real city assets with source, author, license and transformation records.
- [x] Add ocean hero depth, route drawing, one sticky four-stage journey, selected-node scene updates and modest page transitions.
- [x] Use stepFromProgress for real scroll state; support manual stage selection.
- [x] Clean up GSAP contexts/listeners; skip nonessential motion under reduced-motion and pause offscreen backgrounds.
- [x] Inspect 1440/390px screenshots and correct actual layout issues.

## Task 4: Browser verification, independent review and delivery

Files: tests/browser.mjs, README.md, docs/verification.md, delivery/.

- [x] Check desktop/mobile navigation, cooperation validation/clipboard, scene switching and browser back behavior.
- [x] Check reduced-motion, keyboard menu/Escape, no horizontal overflow, 200% zoom and JavaScript-disabled reading.
- [x] Record browser console errors and resource sizes; run performance checks where available.
- [x] Request an independent read-only code review; fix material findings and repeat the covering verification.
- [x] Produce the static dist, portable source archive and local preview instructions; preserve work in the workspace.

## Progress

- Design and implementation authorized by the user's request to make the site.
- The current workspace is already separate from the original repository; no managed worktree or outside-workspace Git metadata is created.
- Public contact information requested asynchronously; rendering and other tasks continue while awaiting it.
