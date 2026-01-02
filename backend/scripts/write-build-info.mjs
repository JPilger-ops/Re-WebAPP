#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const TARGET_FILE = path.join(ROOT, "build-info.json");

const runGit = (cmd) => {
  try {
    return execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
};

const pick = (...candidates) => candidates.find((val) => Boolean(String(val || "").trim())) || "";

let existing = null;
try {
  existing = JSON.parse(fs.readFileSync(TARGET_FILE, "utf8"));
} catch {
  existing = null;
}

const sha = pick(
  process.env.BUILD_SHA,
  runGit("git rev-parse --short HEAD"),
  existing?.sha,
  "unknown"
).trim();
const numberRaw = pick(
  process.env.BUILD_NUMBER,
  runGit("git rev-list --count HEAD"),
  existing?.number,
  "0"
).trim();
const time = pick(
  process.env.BUILD_TIME,
  runGit("git show -s --format=%cI HEAD"),
  existing?.time,
  new Date().toISOString()
).trim();

const number = Number.parseInt(numberRaw, 10);
const normalizedNumber = Number.isFinite(number) ? number : 0;

const payload = {
  sha,
  number: normalizedNumber,
  time,
};

fs.writeFileSync(TARGET_FILE, JSON.stringify(payload, null, 2));
console.log(`[build-info] sha=${sha} number=${normalizedNumber} time=${time}`);
