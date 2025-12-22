import fs from "fs";
import path from "path";
import { prisma } from "./prisma.js";

const DEFAULT_PDF_DIR = process.env.PDF_STORAGE_PATH || "/app/pdfs";

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
  const dir = await getResolvedPdfPath();
  return { storage_path: dir, default_path: DEFAULT_PDF_DIR };
};

export const savePdfSettings = async ({ storage_path }) => {
  const target = (storage_path || "").trim() || DEFAULT_PDF_DIR;
  const saved = await prisma.pdf_settings.upsert({
    where: { id: 1 },
    update: { storage_path: target },
    create: { id: 1, storage_path: target },
  });
  return { storage_path: saved.storage_path, default_path: DEFAULT_PDF_DIR };
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
