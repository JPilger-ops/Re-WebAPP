import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pkg = require("../../package.json");

export const getVersion = (_req, res) => {
  const version = process.env.APP_VERSION || pkg.version || "0.0.0";
  const buildSha = (process.env.BUILD_SHA || process.env.APP_BUILD || "").trim() || "unknown";
  const buildTime = (process.env.BUILD_TIME || "").trim() || "unknown";
  const buildNumberRaw = (process.env.BUILD_NUMBER || process.env.APP_BUILD_NUMBER || "").trim();
  const parsedBuildNumber = Number.parseInt(buildNumberRaw, 10);
  const buildNumber = Number.isFinite(parsedBuildNumber) ? parsedBuildNumber : 0;
  res.json({
    version,
    build: {
      sha: buildSha,
      time: buildTime,
      number: buildNumber,
    },
  });
};
