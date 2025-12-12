import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pkg = require("../../package.json");

const VERSION = process.env.APP_VERSION || pkg.version || "0.0.0";
const BUILD = process.env.APP_BUILD || null;

export const getVersion = (req, res) => {
  res.json({
    version: VERSION,
    build: BUILD,
  });
};
