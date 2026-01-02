import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BUILD_INFO_PATH = path.resolve(__dirname, "../../build-info.json");
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const readBuildInfoFile = () => {
  try {
    const raw = fs.readFileSync(BUILD_INFO_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const runGit = (cmd) => {
  try {
    return execSync(cmd, { cwd: PROJECT_ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
};

const normalizeNumber = (value) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const resolveBuildInfo = () => {
  const fileInfo = readBuildInfoFile();

  const buildSha =
    (process.env.BUILD_SHA || process.env.APP_BUILD || "").trim() ||
    runGit("git rev-parse --short HEAD") ||
    (fileInfo?.sha || "").trim() ||
    "unknown";

  const buildTime =
    (process.env.BUILD_TIME || "").trim() ||
    runGit("git show -s --format=%cI HEAD") ||
    (fileInfo?.time || "").trim() ||
    "unknown";

  const buildNumber = normalizeNumber(
    (process.env.BUILD_NUMBER || process.env.APP_BUILD_NUMBER || "").trim() ||
      (fileInfo?.number ?? "") ||
      runGit("git rev-list --count HEAD")
  );

  const version = process.env.APP_VERSION || pkg.version || "0.0.0";

  return {
    version,
    sha: buildSha,
    time: buildTime,
    number: buildNumber,
  };
};
