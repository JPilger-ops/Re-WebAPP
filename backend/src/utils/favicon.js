import fs from "fs";
import path from "path";
import { prisma } from "./prisma.js";

const PUBLIC_DIR = path.resolve("public");
const DEFAULT_FILENAME = "RE-WebAPP.png";
const DEFAULT_SUBDIR = "logos";
const TARGET_FILENAME = "favicon.ico";

const allowedMime = ["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml"];
const MAX_SIZE = 1024 * 1024; // 1MB

export const getFaviconSettings = async () => {
  const row = await prisma.favicon_settings.findUnique({ where: { id: 1 } });
  return row || { filename: TARGET_FILENAME };
};

export const saveFavicon = async ({ buffer, mime }) => {
  if (!allowedMime.includes(mime)) {
    const err = new Error("Ungültiges Dateiformat. Erlaubt: PNG, ICO, SVG.");
    err.status = 400;
    throw err;
  }
  if (!buffer || buffer.length === 0) {
    const err = new Error("Leere Datei.");
    err.status = 400;
    throw err;
  }
  if (buffer.length > MAX_SIZE) {
    const err = new Error("Datei zu groß (max 1MB).");
    err.status = 400;
    throw err;
  }
  await fs.promises.mkdir(PUBLIC_DIR, { recursive: true });
  const targetPath = path.join(PUBLIC_DIR, TARGET_FILENAME);
  await fs.promises.writeFile(targetPath, buffer);
  const saved = await prisma.favicon_settings.upsert({
    where: { id: 1 },
    update: { filename: TARGET_FILENAME, updated_at: new Date() },
    create: { id: 1, filename: TARGET_FILENAME },
  });
  return { ...saved, path: targetPath };
};

export const resetFavicon = async () => {
  const source = path.join(PUBLIC_DIR, DEFAULT_SUBDIR, DEFAULT_FILENAME);
  const targetPath = path.join(PUBLIC_DIR, TARGET_FILENAME);
  await fs.promises.copyFile(source, targetPath);
  const saved = await prisma.favicon_settings.upsert({
    where: { id: 1 },
    update: { filename: TARGET_FILENAME, updated_at: new Date() },
    create: { id: 1, filename: TARGET_FILENAME },
  });
  return { ...saved, path: targetPath };
};

export const resolveFaviconPath = async () => {
  const settings = await getFaviconSettings();
  const targetPath = path.join(PUBLIC_DIR, TARGET_FILENAME);
  const exists = await fs.promises
    .access(targetPath, fs.constants.R_OK)
    .then(() => true)
    .catch(() => false);
  if (exists) return { path: targetPath, updated_at: settings.updated_at };
  // Fallback to default
  const defPath = path.join(PUBLIC_DIR, DEFAULT_SUBDIR, DEFAULT_FILENAME);
  return { path: defPath, updated_at: settings.updated_at };
};
