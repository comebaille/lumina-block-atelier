import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const baseUrl = "http://127.0.0.1:4173/";
const resultsDir = new URL("../test-results/", import.meta.url);

await mkdir(resultsDir, { recursive: true });

const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, LUMINA_PORT: "4173", LUMINA_HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"]
});

let serverError = "";
server.stderr.on("data", (chunk) => {
  serverError += chunk.toString();
});

try {
  await waitForServer();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    await verifyPrimaryMobile(browser);
    await verifyViewport(browser, { width: 360, height: 740 }, "mobile-360x740.png");
    await verifyViewport(browser, { width: 430, height: 932 }, "mobile-430x932.png");
    await verifyViewport(browser, { width: 900, height: 900 }, "desktop-shell.png", false);
  } finally {
    await browser.close();
  }
  process.stdout.write("Browser verification passed: interpolated drag, zero-point placement, combo clear, material shift, all-clear VFX, settings, pause, 3 responsive viewports, and zero axe violations.\n");
} finally {
  server.kill("SIGTERM");
}

async function verifyPrimaryMobile(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    locale: "fr-FR",
    reducedMotion: "no-preference"
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("#welcomeDialog[open]").waitFor();
  await runAxe(page, "welcome dialog");
  await page.locator("#startButton").click();
  await page.locator("#welcomeDialog").waitFor({ state: "hidden" });

  assert.equal(await page.locator(".board-cell").count(), 64);
  assert.equal(await page.locator(".piece-card").count(), 3);
  await assertNoOverflow(page, "390x844");

  await dragFirstPiece(page);
  assert.equal(await page.locator(".piece-card:disabled").count(), 1);
  assert.equal((await page.evaluate(() => window.__LUMINA_TEST__.getState())).score, 0, "a simple placement must award no points");

  const dragMetrics = await page.evaluate(() => window.__LUMINA_TEST__.getInputMetrics());
  assert.ok(dragMetrics.activationToFrame.count >= 1, `Missing activation metric: ${JSON.stringify(dragMetrics)}`);
  assert.ok(dragMetrics.moveToFrame.count >= 1, `Missing move metric: ${JSON.stringify(dragMetrics)}`);
  assert.ok(dragMetrics.moveToFrame.p95 < 80, `Drag response p95 is too high: ${JSON.stringify(dragMetrics)}`);

  await loadLineClearScenario(page, { allClear: false });
  assert.equal(await page.evaluate(() => window.__LUMINA_TEST__.placePiece(0, 0, 7)), true);
  assert.equal(await page.locator("#comboCallout").getAttribute("data-effect"), "clear");
  await page.waitForFunction(() => document.body.dataset.material === "opal");
  const clearState = await page.evaluate(() => window.__LUMINA_TEST__.getState());
  assert.equal(clearState.score, 100);
  assert.equal(clearState.combo, 1);
  assert.equal(clearState.comboGrace, 3);
  assert.equal(await page.locator("#comboBadge.is-visible").count(), 1);

  await loadLineClearScenario(page, { allClear: true });
  assert.equal(await page.evaluate(() => window.__LUMINA_TEST__.placePiece(0, 0, 7)), true);
  assert.equal(await page.locator("#comboCallout").getAttribute("data-effect"), "all-clear");
  await page.waitForTimeout(120);
  await page.screenshot({ path: fileURLToPath(new URL("all-clear-explosion.png", resultsDir)), fullPage: true });
  await page.waitForFunction(() => document.body.dataset.material === "opal");
  const allClearState = await page.evaluate(() => window.__LUMINA_TEST__.getState());
  assert.equal(allClearState.score, 2_600);
  assert.ok(allClearState.board.every((row) => row.every((cell) => cell === null)));

  await captureMaterialStates(page);

  await page.locator("#settingsButton").click();
  await page.locator("#motionToggle").check({ force: true });
  await page.locator("#contrastToggle").check({ force: true });
  assert.equal(await page.locator("body.is-reduced-motion").count(), 1);
  assert.equal(await page.locator("body.is-high-contrast").count(), 1);
  await page.locator('[data-close-dialog="settingsDialog"]').click();

  await page.locator("#pauseButton").click();
  await page.locator("#pauseDialog[open]").waitFor();
  await page.locator("#resumeButton").click();
  await page.locator("#pauseDialog").waitFor({ state: "hidden" });

  await runAxe(page, "active game");
  await assertNoOverflow(page, "390x844 after interactions");
  await page.screenshot({ path: fileURLToPath(new URL("mobile-390x844.png", resultsDir)), fullPage: true });
  assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
}

async function dragFirstPiece(page) {
  const start = await page.locator(".piece-card:not(:disabled)").first().boundingBox();
  assert.ok(start, "The first piece card has no box");
  const geometry = await page.evaluate(() => {
    const piece = window.__LUMINA_TEST__.getState().tray[0];
    const cell = document.querySelector(".board-cell");
    const board = document.querySelector("#board");
    const rect = cell.getBoundingClientRect();
    const style = getComputedStyle(board);
    const stepX = rect.width + (Number.parseFloat(style.columnGap) || 0);
    const stepY = rect.height + (Number.parseFloat(style.rowGap) || 0);
    const rows = Math.max(...piece.cells.map(([row]) => row)) + 1;
    const cols = Math.max(...piece.cells.map(([, col]) => col)) + 1;
    const anchorRow = Math.floor((8 - rows) / 2);
    const anchorCol = Math.floor((8 - cols) / 2);
    const tuning = window.__LUMINA_TEST__.getInputMetrics().tuning;
    const lift = Math.min(tuning.dragLiftMax, Math.max(tuning.dragLiftMin, innerHeight * tuning.dragLiftRatio));
    return {
      x: rect.left + rect.width / 2 + stepX * (anchorCol + (cols - 1) / 2),
      y: rect.top + rect.height / 2 + stepY * (anchorRow + (rows - 1) / 2) + lift
    };
  });

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(geometry.x, geometry.y, { steps: 18 });
  await page.locator(".drag-ghost").waitFor();
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelectorAll(".piece-card:disabled").length === 1);
}

async function loadLineClearScenario(page, { allClear }) {
  await page.evaluate(({ allClear: shouldClearAll }) => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let col = 0; col < 7; col += 1) board[0][col] = "gold";
    if (!shouldClearAll) board[2][2] = "mint";
    window.__LUMINA_TEST__.loadScenario({
      board,
      tray: [{ shapeId: "spark", palette: "coral" }, null, null],
      score: 0,
      lines: 0,
      combo: 0,
      comboGrace: 0,
      materialIndex: 0,
      moves: 0
    });
  }, { allClear });
  await page.waitForFunction(() => document.body.dataset.material === "prism");
}

async function captureMaterialStates(page) {
  for (const material of [
    { id: "opal", index: 1 },
    { id: "solar", index: 2 },
    { id: "void", index: 3 }
  ]) {
    await page.evaluate(({ materialIndex }) => {
      const palettes = ["cyan", "violet", "coral", "gold", "mint"];
      const board = Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => ((row + col) % 3 === 0 ? palettes[(row + col) % palettes.length] : null))
      );
      window.__LUMINA_TEST__.loadScenario({
        board,
        tray: [
          { shapeId: "trio-h", palette: "mint" },
          { shapeId: "corner-br", palette: "violet" },
          { shapeId: "square-2", palette: "gold" }
        ],
        materialIndex,
        score: 0,
        combo: 0,
        comboGrace: 0
      });
    }, { materialIndex: material.index });
    await page.waitForFunction((expected) => document.body.dataset.material === expected, material.id);
    await page.screenshot({ path: fileURLToPath(new URL(`material-${material.id}.png`, resultsDir)), fullPage: true });
  }
}

async function verifyViewport(browser, viewport, filename, mobile = true) {
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, locale: "fr-FR" });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("#startButton").click();
  await page.locator("#welcomeDialog").waitFor({ state: "hidden" });
  await assertNoOverflow(page, `${viewport.width}x${viewport.height}`);

  const boardBox = await page.locator("#board").boundingBox();
  assert.ok(boardBox && boardBox.width >= 230, `Board is too small at ${viewport.width}x${viewport.height}`);
  assert.ok(boardBox && boardBox.y + boardBox.height <= viewport.height, `Board is clipped at ${viewport.width}x${viewport.height}`);
  await page.screenshot({ path: fileURLToPath(new URL(filename, resultsDir)), fullPage: true });
  await context.close();
}

async function runAxe(page, label) {
  await page.addScriptTag({ path: axePath });
  const report = await page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag22aa"] }
  }));
  assert.deepEqual(
    report.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => node.target) })),
    [],
    `${label} has accessibility violations`
  );
}

async function assertNoOverflow(page, label) {
  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
    bodyWidth: document.body.scrollWidth
  }));
  assert.ok(layout.documentWidth <= layout.viewportWidth + 1, `${label} has horizontal overflow: ${JSON.stringify(layout)}`);
  assert.ok(layout.bodyWidth <= layout.viewportWidth + 1, `${label} body overflows: ${JSON.stringify(layout)}`);
}

async function waitForServer() {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Server exited early: ${serverError}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Keep polling during startup.
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for the local server. ${serverError}`);
}
