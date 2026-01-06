import path from "path";
import {
  createBackup,
  deleteBackup,
  listBackups,
  loadBackupConfig,
  restoreBackup,
  saveBackupConfig,
  streamBackupFile,
  streamInvoicesArchive,
  testBackupPath,
} from "../utils/backup.js";

const assertAbsolute = (value, label) => {
  if (!value || typeof value !== "string") throw new Error(`${label} darf nicht leer sein.`);
  if (!path.isAbsolute(value)) throw new Error(`${label} muss absolut sein.`);
  return value;
};

export const getBackupSettings = async (_req, res) => {
  try {
    const cfg = await loadBackupConfig();
    res.json(cfg);
  } catch (err) {
    console.error("[backup] settings fetch failed:", err);
    return res.status(500).json({ message: "Backups-Einstellungen konnten nicht geladen werden." });
  }
};

export const updateBackupSettings = async (req, res) => {
  const { local_path, nas_path, default_target, retention } = req.body || {};
  try {
    const next = await saveBackupConfig({
      local_path: local_path ? assertAbsolute(local_path, "Lokaler Pfad") : undefined,
      nas_path: nas_path ? assertAbsolute(nas_path, "NAS Pfad") : nas_path === "" ? null : undefined,
      default_target: default_target === "nas" ? "nas" : "local",
      retention: retention ?? null,
    });
    await testBackupPath(next.local_path);
    if (next.nas_path) {
      await testBackupPath(next.nas_path).catch((err) => {
        console.warn("[backup] NAS Pfad nicht beschreibbar:", err?.message || err);
      });
    }
    res.json(next);
  } catch (err) {
    console.error("[backup] settings update failed:", err);
    return res.status(400).json({ message: err?.message || "Einstellungen konnten nicht gespeichert werden." });
  }
};

export const testBackupPathHandler = async (req, res) => {
  const { path: dir } = req.body || {};
  try {
    const resolved = await testBackupPath(dir);
    res.json({ ok: true, path: resolved });
  } catch (err) {
    return res.status(400).json({ message: err?.message || "Pfad-Test fehlgeschlagen." });
  }
};

export const listBackupsHandler = async (_req, res) => {
  try {
    const entries = await listBackups();
    res.json(entries);
  } catch (err) {
    console.error("[backup] list failed:", err);
    return res.status(500).json({ message: err?.message || "Backups konnten nicht geladen werden." });
  }
};

export const createBackupHandler = async (req, res) => {
  const { target, include_db = true, include_files = true, include_env = true } = req.body || {};
  try {
    const backup = await createBackup({
      target: target === "nas" ? "nas" : "local",
      include_db: Boolean(include_db),
      include_files: Boolean(include_files),
      include_env: Boolean(include_env),
    });
    res.json({ backup });
  } catch (err) {
    console.error("[backup] creation failed:", err);
    return res.status(500).json({ message: err?.message || "Backup fehlgeschlagen." });
  }
};

export const restoreBackupHandler = async (req, res) => {
  const { name, target = "local", restore_db = true, restore_files = true, restore_env = false } = req.body || {};
  if (!name) return res.status(400).json({ message: "Backup-Datei fehlt." });
  try {
    const result = await restoreBackup({
      name,
      target: target === "nas" ? "nas" : "local",
      restore_db: Boolean(restore_db),
      restore_files: Boolean(restore_files),
      restore_env: Boolean(restore_env),
    });
    res.json({ message: "Backup wiederhergestellt.", result });
  } catch (err) {
    console.error("[backup] restore failed:", err);
    return res.status(500).json({ message: err?.message || "Restore fehlgeschlagen." });
  }
};

export const downloadBackupHandler = async (req, res) => {
  const { name } = req.params;
  const target = req.query.target === "nas" ? "nas" : "local";
  if (!name) return res.status(400).json({ message: "Dateiname fehlt." });
  try {
    const stream = await streamBackupFile({ name, target, res });
    stream.on("error", (err) => {
      console.error("[backup] download stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Download fehlgeschlagen." });
      } else {
        res.destroy(err);
      }
    });
    stream.pipe(res);
  } catch (err) {
    console.error("[backup] download failed:", err);
    return res.status(404).json({ message: err?.message || "Backup nicht gefunden." });
  }
};

export const deleteBackupHandler = async (req, res) => {
  const { name } = req.params;
  const target = req.query.target === "nas" ? "nas" : "local";
  if (!name) return res.status(400).json({ message: "Dateiname fehlt." });
  try {
    await deleteBackup({ name, target });
    res.json({ message: "Backup gelöscht." });
  } catch (err) {
    console.error("[backup] delete failed:", err);
    return res.status(404).json({ message: err?.message || "Backup konnte nicht gelöscht werden." });
  }
};

export const invoicesArchiveHandler = async (_req, res) => {
  try {
    await streamInvoicesArchive({ res });
  } catch (err) {
    console.error("[backup] invoice archive failed:", err);
    return res.status(500).json({ message: err?.message || "Archiv konnte nicht erstellt werden." });
  }
};
