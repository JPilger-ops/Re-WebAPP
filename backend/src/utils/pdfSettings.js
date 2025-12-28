import fs from "fs";
import path from "path";
import { prisma } from "./prisma.js";

const DEFAULT_PDF_DIR = process.env.PDF_STORAGE_PATH || "/app/pdfs";
const DEFAULT_ARCHIVE_DIR = process.env.PDF_ARCHIVE_PATH || null;
const DEFAULT_TRASH_DIR = process.env.PDF_TRASH_PATH || null;

export const getResolvedPdfPath = async () => {
  try {
    const row = await prisma.pdf_settings.findFirst({ where: { id: 1 } });
    const configured = row?.storage_path?.trim();
    return configured || DEFAULT_PDF_DIR;
  } catch (err) {
    console.warn("[pdf] Konnte pdf_settings nicht lesen, nutze Default:", err?.message);
    return DEFAULT_PDF_DIR;
  }
};

export const getPdfSettings = async () => {
  const row = await prisma.pdf_settings.findFirst({ where: { id: 1 } });
  const dir = row?.storage_path?.trim() || DEFAULT_PDF_DIR;
  const archive = row?.archive_path?.trim() || DEFAULT_ARCHIVE_DIR || null;
  const trash = row?.trash_path?.trim() || DEFAULT_TRASH_DIR || null;
  return {
    storage_path: dir,
    archive_path: archive,
    trash_path: trash,
    default_path: DEFAULT_PDF_DIR,
    default_archive: DEFAULT_ARCHIVE_DIR,
    default_trash: DEFAULT_TRASH_DIR,
  };
};

export const savePdfSettings = async ({ storage_path, archive_path, trash_path }) => {
  const target = (storage_path || "").trim() || DEFAULT_PDF_DIR;
  const archive = (archive_path || "").trim() || null;
  const trash = (trash_path || "").trim() || null;
  const saved = await prisma.pdf_settings.upsert({
    where: { id: 1 },
    update: { storage_path: target, archive_path: archive, trash_path: trash },
    create: { id: 1, storage_path: target, archive_path: archive, trash_path: trash },
  });
  return {
    storage_path: saved.storage_path,
    archive_path: saved.archive_path || null,
    trash_path: saved.trash_path || null,
    default_path: DEFAULT_PDF_DIR,
    default_archive: DEFAULT_ARCHIVE_DIR,
    default_trash: DEFAULT_TRASH_DIR,
  };
};

export const testPdfPathWritable = async (dir) => {
  const target = (dir || "").trim();
  if (!target) throw new Error("Pfad darf nicht leer sein.");

  const resolved = path.resolve(target);
  await fs.promises.mkdir(resolved, { recursive: true });
  const tmp = path.join(resolved, `.pdf-write-test-${Date.now()}.tmp`);
  await fs.promises.writeFile(tmp, "pdf-test");
  await fs.promises.unlink(tmp);
  return resolved;
};
