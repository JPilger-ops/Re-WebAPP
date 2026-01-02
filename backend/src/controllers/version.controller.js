import { resolveBuildInfo } from "../utils/buildInfo.js";

export const getVersion = (_req, res) => {
  const info = resolveBuildInfo();
  res.json({
    version: info.version,
    build: {
      sha: info.sha,
      time: info.time,
      number: info.number,
    },
  });
};
