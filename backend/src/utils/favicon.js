import fs from "fs";
import path from "path";
import { prisma } from "./prisma.js";

const PUBLIC_DIR = path.resolve("public");
const DEFAULT_FILENAME = "RE-WebAPP.png";
const DEFAULT_SUBDIR = "logos";
const TARGET_FILENAME = "favicon.ico";
const TRANSPARENT_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";

const allowedMime = ["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml"];
const MAX_SIZE = 1024 * 1024; // 1MB

const ensureDir = async (dir) => {
  await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
};

const exists = async (p) =>
  fs.promises
    .access(p, fs.constants.R_OK)
    .then(() => true)
    .catch(() => false);

const ensureDirSync = (dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
};

const writeIfMissingSync = (targetPath, base64) => {
  try {
    if (!fs.existsSync(targetPath)) {
      fs.writeFileSync(targetPath, Buffer.from(base64, "base64"));
    }
  } catch {
    // ignore
  }
};

export const ensureBrandingAssetsSync = () => {
  try {
    ensureDirSync(PUBLIC_DIR);
    ensureDirSync(path.join(PUBLIC_DIR, DEFAULT_SUBDIR));
    const faviconPath = path.join(PUBLIC_DIR, TARGET_FILENAME);
    if (!fs.existsSync(faviconPath)) {
      writeIfMissingSync(faviconPath, TRANSPARENT_PNG_BASE64);
    }
  } catch {
    // ignore to avoid crashing startup
  }
};

export const ensureBrandingAssets = async () => {
  ensureBrandingAssetsSync();
};

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
  ensureBrandingAssetsSync();
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
  ensureBrandingAssetsSync();
  await ensureDir(path.join(PUBLIC_DIR, DEFAULT_SUBDIR));
  const source = path.join(PUBLIC_DIR, DEFAULT_SUBDIR, DEFAULT_FILENAME);
  const targetPath = path.join(PUBLIC_DIR, TARGET_FILENAME);
  await fs.promises.copyFile(source, targetPath).catch((err) => {
    err.status = 500;
    throw err;
  });
  const saved = await prisma.favicon_settings.upsert({
    where: { id: 1 },
    update: { filename: TARGET_FILENAME, updated_at: new Date() },
    create: { id: 1, filename: TARGET_FILENAME },
  });
  return { ...saved, path: targetPath };
};

export const resolveFaviconPath = async () => {
  const settings = await getFaviconSettings();
  ensureBrandingAssetsSync();
  const targetPath = path.join(PUBLIC_DIR, TARGET_FILENAME);
  const defPath = path.join(PUBLIC_DIR, DEFAULT_SUBDIR, DEFAULT_FILENAME);

  if (!(await exists(targetPath))) {
    if (await exists(defPath)) {
      await fs.promises.copyFile(defPath, targetPath).catch(() => {});
    }
  }

  if (await exists(targetPath)) {
    return { path: targetPath, updated_at: settings.updated_at };
  }
  // Fallback to default
  if (await exists(defPath)) {
    return { path: defPath, updated_at: settings.updated_at };
  }
  // Let express handle missing file; avoids unhandled ENOENT in sendFile
  return { path: defPath, updated_at: settings.updated_at };
};
