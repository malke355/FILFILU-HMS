/**
 * Prepare static host output (Vercel / Netlify / similar).
 * Copies landing/ → deploy-static/ so the platform serves real HTML, not an empty app root.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "landing");
const dest = path.join(root, "deploy-static");

if (!fs.existsSync(src)) {
  console.error("Missing landing/ folder — cannot build static site.");
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });

// Friendly 404 → home (helps some static hosts)
const index = path.join(dest, "index.html");
const notFound = path.join(dest, "404.html");
if (fs.existsSync(index) && !fs.existsSync(notFound)) {
  fs.copyFileSync(index, notFound);
}

console.log(`Static site ready: ${dest}`);
console.log("Deploy this folder (or let Vercel use outputDirectory: deploy-static).");
