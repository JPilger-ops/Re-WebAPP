import { prisma } from "./prisma.js";

let cache = {
  cors_origins: [],
  trust_proxy: true,
  initialized: false,
};

let defaults = {
  cors_origins: ["https://rechnung.intern", "http://rechnung.intern"],
  trust_proxy: true,
};

let appRef = null;

export const setNetworkDefaults = ({ cors_origins, trust_proxy }) => {
  if (Array.isArray(cors_origins) && cors_origins.length) {
    defaults.cors_origins = cors_origins;
  }
  if (typeof trust_proxy === "boolean") {
    defaults.trust_proxy = trust_proxy;
  }
};

const isValidOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.pathname && !url.search && !url.hash;
  } catch {
    return false;
  }
};

const normalizeOrigins = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((o) => o.trim()).filter(Boolean);
  return String(input)
    .split(/[,;\n]/)
    .map((o) => o.trim())
    .filter(Boolean);
};

export const getNetworkSettings = async () => {
  const row = await prisma.network_settings.findUnique({ where: { id: 1 } });
  if (!row) {
    return {
      cors_origins: defaults.cors_origins,
      trust_proxy: defaults.trust_proxy,
    };
  }
  return {
    cors_origins: normalizeOrigins(row.cors_origins?.split(",") || row.cors_origins) || defaults.cors_origins,
    trust_proxy: row.trust_proxy === 1 || row.trust_proxy === true,
    updated_at: row.updated_at || null,
  };
};

export const loadNetworkSettingsCache = async () => {
  try {
    const settings = await getNetworkSettings();
    cache = {
      cors_origins: settings.cors_origins?.length ? settings.cors_origins : defaults.cors_origins,
      trust_proxy: settings.trust_proxy ?? defaults.trust_proxy,
      initialized: true,
    };
    if (appRef) {
      appRef.set("trust proxy", cache.trust_proxy ? 1 : 0);
    }
  } catch (err) {
    cache = {
      cors_origins: defaults.cors_origins,
      trust_proxy: defaults.trust_proxy,
      initialized: false,
    };
  }
};

export const getAllowedOrigins = () => cache.cors_origins?.length ? cache.cors_origins : defaults.cors_origins;
export const getTrustProxy = () => (cache.trust_proxy ?? defaults.trust_proxy);

export const saveNetworkSettings = async ({ cors_origins, trust_proxy }) => {
  const origins = normalizeOrigins(cors_origins);
  if (!origins.length) {
    const err = new Error("Mindestens eine Origin angeben.");
    err.status = 400;
    throw err;
  }
  if (origins.length > 20) {
    const err = new Error("Zu viele Origins (max 20).");
    err.status = 400;
    throw err;
  }
  for (const origin of origins) {
    if (!isValidOrigin(origin)) {
      const err = new Error(`Ungültige Origin: ${origin}`);
      err.status = 400;
      throw err;
    }
    if (origin === "*") {
      const err = new Error("Wildcard * ist nicht erlaubt.");
      err.status = 400;
      throw err;
    }
  }
  const trust = typeof trust_proxy === "string" ? ["1", "true", "yes", "on"].includes(trust_proxy.toLowerCase()) : Boolean(trust_proxy);
  const saved = await prisma.network_settings.upsert({
    where: { id: 1 },
    update: { cors_origins: origins.join(","), trust_proxy: trust ? 1 : 0, updated_at: new Date() },
    create: { id: 1, cors_origins: origins.join(","), trust_proxy: trust ? 1 : 0 },
  });
  cache = { cors_origins: origins, trust_proxy: trust, initialized: true };
  if (appRef) {
    appRef.set("trust proxy", trust ? 1 : 0);
  }
  return { cors_origins: origins, trust_proxy: trust, updated_at: saved.updated_at || new Date() };
};

export const setNetworkApp = (app) => {
  appRef = app;
  if (appRef) {
    appRef.set("trust proxy", getTrustProxy() ? 1 : 0);
  }
};

export const getEffectiveTrustProxy = () => {
  if (appRef) return appRef.get("trust proxy");
  return getTrustProxy() ? 1 : 0;
};
