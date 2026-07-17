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
  process.stdout.write("Browser verification passed: tactile placement, settings, pause, 3 responsive viewports, and zero axe violations.\n");
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

  await page.locator(".piece-card:not(:disabled)").first().click();
  const validCell = page.locator('.board-cell[data-valid-anchor="true"]').first();
  await validCell.waitFor();
  await validCell.click();
  await page.waitForFunction(() => Number(document.querySelector("#scoreValue")?.textContent?.replace(/\D/g, "")) > 0);
  assert.equal(await page.locator(".piece-card:disabled").count(), 1);

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
