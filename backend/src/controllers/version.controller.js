import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pkg = require("../../package.json");

export const getVersion = (_req, res) => {
  const version = process.env.APP_VERSION || pkg.version || "0.0.0";
  const buildSha = process.env.BUILD_SHA || process.env.APP_BUILD || "unknown";
  const buildTime = process.env.BUILD_TIME || "unknown";
  res.json({
    version,
    build: {
      sha: buildSha,
      time: buildTime,
    },
  });
};
