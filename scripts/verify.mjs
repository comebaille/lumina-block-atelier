import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const requiredFiles = [
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  "src/app.js",
  "src/audio.js",
  "src/engine.js",
  "assets/art/crystal-sanctum.webp",
  "assets/materials/opal.webp",
  "assets/materials/solar.webp",
  "assets/materials/void.webp",
  "assets/icons/icon.svg",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "asset-manifest.json"
];

const errors = [];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) errors.push(`Missing required file: ${file}`);
}

for (const file of ["src/app.js", "src/audio.js", "src/engine.js", "sw.js", "scripts/serve.mjs", "scripts/e2e.mjs"]) {
  const result = spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) errors.push(`Syntax error in ${file}:\n${result.stderr.trim()}`);
}

const manifest = JSON.parse(readFileSync(resolve(root, "manifest.webmanifest"), "utf8"));
if (manifest.display !== "standalone") errors.push("PWA manifest must use standalone display mode");
if (manifest.orientation !== "portrait") errors.push("PWA manifest must declare portrait orientation");
if (!String(manifest.start_url).startsWith("./")) errors.push("PWA start_url must remain relative for GitHub Pages");

for (const icon of manifest.icons || []) {
  const iconPath = String(icon.src).replace(/^\.\//, "");
  if (!existsSync(resolve(root, iconPath))) errors.push(`Manifest icon does not exist: ${icon.src}`);
}

const html = readFileSync(resolve(root, "index.html"), "utf8");
for (const requiredFragment of ['lang="fr"', "viewport-fit=cover", "apple-mobile-web-app-capable", 'id="liveRegion"']) {
  if (!html.includes(requiredFragment)) errors.push(`index.html lacks ${requiredFragment}`);
}

const webpSize = statSync(resolve(root, "assets/art/crystal-sanctum.webp")).size;
if (webpSize > 250_000) errors.push(`Hero WebP exceeds the 250 KB visual budget: ${webpSize} bytes`);

for (const material of ["opal", "solar", "void"]) {
  const materialSize = statSync(resolve(root, `assets/materials/${material}.webp`)).size;
  if (materialSize > 350_000) errors.push(`${material} material WebP exceeds the 350 KB budget: ${materialSize} bytes`);
}

const textExtensions = new Set([".html", ".css", ".js", ".json", ".webmanifest", ".md"]);
for (const file of requiredFiles) {
  if (!textExtensions.has(extname(file)) || !existsSync(resolve(root, file))) continue;
  const content = readFileSync(resolve(root, file), "utf8");
  const hotlink = content.match(/https?:\/\/[^\s"')]+\.(?:png|jpe?g|webp|gif|svg|woff2?)/i);
  if (hotlink) errors.push(`Remote runtime asset found in ${file}: ${hotlink[0]}`);
}

if (errors.length) {
  for (const error of errors) process.stderr.write(`ERROR: ${error}\n`);
  process.exit(1);
}

process.stdout.write(`Static verification passed: ${requiredFiles.length} required files, valid PWA metadata, ${Math.round(webpSize / 1024)} KB hero.\n`);
