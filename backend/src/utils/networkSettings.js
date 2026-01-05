import { prisma } from "./prisma.js";

let cache = {
  cors_origins: [],
  trust_proxy: true,
  auth_cookie_samesite: "lax",
  auth_token_ttl_minutes: 720,
  initialized: false,
};

let defaults = {
  cors_origins: ["https://rechnung.intern", "http://rechnung.intern"],
  trust_proxy: true,
  auth_cookie_samesite: (process.env.AUTH_COOKIE_SAMESITE || "lax").toLowerCase(),
  auth_token_ttl_minutes: Number(process.env.AUTH_TOKEN_TTL_MINUTES || Number(process.env.AUTH_TOKEN_TTL_HOURS || 12) * 60),
};

let appRef = null;

export const setNetworkDefaults = ({ cors_origins, trust_proxy }) => {
  if (Array.isArray(cors_origins) && cors_origins.length) {
    defaults.cors_origins = cors_origins;
  }
  if (typeof trust_proxy === "boolean") {
    defaults.trust_proxy = trust_proxy;
  }
  const samesite = (process.env.AUTH_COOKIE_SAMESITE || "").toLowerCase();
  if (["lax", "strict", "none"].includes(samesite)) defaults.auth_cookie_samesite = samesite;
  const ttlMin = Number(process.env.AUTH_TOKEN_TTL_MINUTES || Number(process.env.AUTH_TOKEN_TTL_HOURS || 12) * 60);
  if (!Number.isNaN(ttlMin) && ttlMin >= 5 && ttlMin <= 1440) defaults.auth_token_ttl_minutes = ttlMin;
};

const isValidOrigin = (origin) => {
  try {
    const url = new URL(origin);
    const hasOnlyHost =
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.pathname === "" || url.pathname === "/") &&
      !url.search &&
      !url.hash;
    return hasOnlyHost;
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
      auth_cookie_samesite: defaults.auth_cookie_samesite,
      auth_token_ttl_minutes: defaults.auth_token_ttl_minutes,
    };
  }
  return {
    cors_origins: normalizeOrigins(row.cors_origins?.split(",") || row.cors_origins) || defaults.cors_origins,
    trust_proxy: row.trust_proxy === 1 || row.trust_proxy === true,
    auth_cookie_samesite: (row.auth_cookie_samesite || defaults.auth_cookie_samesite || "lax").toLowerCase(),
    auth_token_ttl_minutes: row.auth_token_ttl_minutes || defaults.auth_token_ttl_minutes,
    updated_at: row.updated_at || null,
  };
};

export const loadNetworkSettingsCache = async () => {
  try {
    const settings = await getNetworkSettings();
    cache = {
      cors_origins: settings.cors_origins?.length ? settings.cors_origins : defaults.cors_origins,
      trust_proxy: settings.trust_proxy ?? defaults.trust_proxy,
      auth_cookie_samesite: settings.auth_cookie_samesite || defaults.auth_cookie_samesite || "lax",
      auth_token_ttl_minutes: settings.auth_token_ttl_minutes || defaults.auth_token_ttl_minutes,
      initialized: true,
    };
    if (appRef) {
      appRef.set("trust proxy", cache.trust_proxy ? 1 : 0);
    }
  } catch (err) {
    cache = {
      cors_origins: defaults.cors_origins,
      trust_proxy: defaults.trust_proxy,
      auth_cookie_samesite: defaults.auth_cookie_samesite || "lax",
      auth_token_ttl_minutes: defaults.auth_token_ttl_minutes,
      initialized: false,
    };
  }
};

export const getAllowedOrigins = () => cache.cors_origins?.length ? cache.cors_origins : defaults.cors_origins;
export const getTrustProxy = () => (cache.trust_proxy ?? defaults.trust_proxy);

const normalizeBool = (input) => {
  if (typeof input === "boolean") return input;
  if (typeof input === "number") return input === 1;
  if (typeof input === "string") return ["1", "true", "yes", "on"].includes(input.toLowerCase());
  return false;
};

export const saveNetworkSettings = async ({ cors_origins, trust_proxy, auth_cookie_samesite, auth_token_ttl_minutes }) => {
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
  const trust = normalizeBool(trust_proxy);
  const samesiteRaw = (auth_cookie_samesite || defaults.auth_cookie_samesite || "lax").toLowerCase();
  if (!["lax", "strict", "none"].includes(samesiteRaw)) {
    const err = new Error("auth_cookie_samesite muss 'lax', 'strict' oder 'none' sein.");
    err.status = 400;
    throw err;
  }
  const ttlMinutes = Number(auth_token_ttl_minutes || defaults.auth_token_ttl_minutes || 720);
  if (Number.isNaN(ttlMinutes) || ttlMinutes < 5 || ttlMinutes > 1440) {
    const err = new Error("auth_token_ttl_minutes muss zwischen 5 und 1440 liegen.");
    err.status = 400;
    throw err;
  }
  const saved = await prisma.network_settings.upsert({
    where: { id: 1 },
    update: {
      cors_origins: origins.join(","),
      trust_proxy: trust ? 1 : 0,
      auth_cookie_samesite: samesiteRaw,
      auth_token_ttl_minutes: ttlMinutes,
      updated_at: new Date(),
    },
    create: {
      id: 1,
      cors_origins: origins.join(","),
      trust_proxy: trust ? 1 : 0,
      auth_cookie_samesite: samesiteRaw,
      auth_token_ttl_minutes: ttlMinutes,
    },
  });
  cache = {
    cors_origins: origins,
    trust_proxy: trust,
    auth_cookie_samesite: samesiteRaw,
    auth_token_ttl_minutes: ttlMinutes,
    initialized: true,
  };
  if (appRef) {
    appRef.set("trust proxy", trust ? 1 : 0);
  }
  return {
    cors_origins: origins,
    trust_proxy: trust,
    auth_cookie_samesite: samesiteRaw,
    auth_token_ttl_minutes: ttlMinutes,
    updated_at: saved.updated_at || new Date(),
  };
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

export const getAuthCookieSameSite = () => (cache.auth_cookie_samesite || defaults.auth_cookie_samesite || "lax");
export const getAuthTokenTtlMinutes = () => cache.auth_token_ttl_minutes || defaults.auth_token_ttl_minutes || 720;
