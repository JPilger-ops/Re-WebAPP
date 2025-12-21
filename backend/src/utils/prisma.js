import { PrismaClient } from "@prisma/client";

// Optional fallback builder (only if explicitly enabled) to derive DATABASE_URL from DB_* vars.
// Avoids "magische" Defaults; enable via DATABASE_URL_FALLBACK=1 if env is missing.
const shouldRebuildDbUrl = () => {
  const fallbackEnabled = ["1", "true", "yes"].includes(
    (process.env.DATABASE_URL_FALLBACK || "").toLowerCase()
  );
  if (!fallbackEnabled) return false;
  const url = process.env.DATABASE_URL || "";
  return !url || url.startsWith("prisma+postgres://");
};

if (shouldRebuildDbUrl()) {
  const user = process.env.DB_USER || "rechnung_app";
  const pass = encodeURIComponent(process.env.DB_PASS || "change_me");
  const host = process.env.DB_HOST || "db";
  const port = process.env.DB_PORT || "5432";
  const name = process.env.DB_NAME || "rechnung_prod";
  const schema = process.env.DB_SCHEMA || "public";
  process.env.DATABASE_URL = `postgresql://${user}:${pass}@${host}:${port}/${name}?schema=${schema}`;
}

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error", "warn"],
  });

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}
