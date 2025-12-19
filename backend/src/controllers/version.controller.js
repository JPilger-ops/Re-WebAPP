import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pkg = require("../../package.json");

export const getVersion = (_req, res) => {
  const version = process.env.APP_VERSION || pkg.version || "0.0.0";
  const build = process.env.APP_BUILD || null;
  res.json({
    version,
    build,
  });
};
