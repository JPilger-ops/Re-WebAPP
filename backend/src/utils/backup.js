import fs from "fs";
import path from "path";
import os from "os";
import archiver from "archiver";
import unzipper from "unzipper";
import { spawn } from "child_process";
import { URL } from "url";
import { getPdfSettings } from "./pdfSettings.js";
import { resolveBuildInfo } from "./buildInfo.js";

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_ROOT = process.env.APP_DATA_PATH || path.resolve(ROOT_DIR, "../data");
const CONFIG_PATH = process.env.BACKUP_CONFIG_PATH || path.join(DATA_ROOT, "backup-config.json");
const DEFAULT_LOCAL_PATH = process.env.BACKUP_LOCAL_PATH || path.join(DATA_ROOT, "backups");
const DEFAULT_NAS_PATH = process.env.BACKUP_NAS_PATH || "";
const META_SUFFIX = ".json";

const ensureDir = async (dir) => {
  const resolved = path.resolve(dir);
  await fs.promises.mkdir(resolved, { recursive: true });
  return resolved;
};

const writeableTest = async (dir) => {
  const resolved = await ensureDir(dir);
  const tmp = path.join(resolved, `.write-test-${Date.now()}.tmp`);
  await fs.promises.writeFile(tmp, "ok");
  await fs.promises.unlink(tmp);
  return resolved;
};

const defaultConfig = () => ({
  local_path: DEFAULT_LOCAL_PATH,
  nas_path: DEFAULT_NAS_PATH || null,
  default_target: "local",
  retention: null,
});

export const loadBackupConfig = async () => {
  await ensureDir(path.dirname(CONFIG_PATH));
  const fallback = defaultConfig();
  try {
    const raw = await fs.promises.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return {
      ...fallback,
      ...parsed,
      local_path: parsed.local_path || fallback.local_path,
      nas_path: parsed.nas_path || fallback.nas_path || null,
      default_target: parsed.default_target === "nas" ? "nas" : "local",
      retention: parsed.retention ?? fallback.retention ?? null,
    };
  } catch {
    return fallback;
  }
};

export const saveBackupConfig = async (updates = {}) => {
  const current = await loadBackupConfig();
  const nasProvided = Object.prototype.hasOwnProperty.call(updates, "nas_path");
  const next = {
    ...current,
    ...updates,
    local_path: updates.local_path || current.local_path || DEFAULT_LOCAL_PATH,
    nas_path: nasProvided ? (updates.nas_path || null) : current.nas_path || null,
    default_target: updates.default_target === "nas" ? "nas" : "local",
  };
  await ensureDir(path.dirname(CONFIG_PATH));
  await fs.promises.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
};

export const testBackupPath = async (dir) => {
  if (!dir || typeof dir !== "string") throw new Error("Pfad darf nicht leer sein.");
  if (!path.isAbsolute(dir)) throw new Error("Pfad muss absolut sein.");
  return writeableTest(dir);
};

const resolveDbConfig = () => {
  const url = process.env.DATABASE_URL || "";
  if (url) {
    const parsed = new URL(url.replace(/^postgres:/, "postgresql:"));
    return {
      connectionString: url,
      host: parsed.hostname,
      port: parsed.port || "5432",
      user: decodeURIComponent(parsed.username || ""),
      password: decodeURIComponent(parsed.password || ""),
      database: (parsed.pathname || "").replace(/^\//, "") || "postgres",
    };
  }
  return {
    connectionString: null,
    host: process.env.DB_HOST || "db",
    port: process.env.DB_PORT || "5432",
    user: process.env.DB_USER || "rechnung_app",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "rechnung_prod",
  };
};

const runPgDump = async (destPath) => {
  const cfg = resolveDbConfig();
  const args = [];
  if (cfg.connectionString) {
    args.push(`--dbname=${cfg.connectionString}`);
  } else {
    args.push("-h", cfg.host, "-p", cfg.port, "-U", cfg.user, "-d", cfg.database);
  }
  args.push("--clean", "--if-exists", "--no-owner", "--no-privileges");
  const env = { ...process.env };
  if (cfg.password) env.PGPASSWORD = cfg.password;

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destPath);
    const child = spawn("pg_dump", args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) return resolve();
      return reject(new Error(`pg_dump exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`));
    });
    child.stdout.pipe(out);
  });
};

const runPgRestore = async (sqlPath) => {
  const cfg = resolveDbConfig();
  const args = [];
  if (cfg.connectionString) {
    args.push(`--dbname=${cfg.connectionString}`);
  } else {
    args.push("-h", cfg.host, "-p", cfg.port, "-U", cfg.user, "-d", cfg.database);
  }
  const env = { ...process.env };
  if (cfg.password) env.PGPASSWORD = cfg.password;

  await new Promise((resolve, reject) => {
    const child = spawn("psql", args, { env, stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    fs.createReadStream(sqlPath).pipe(child.stdin);
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) return resolve();
      return reject(new Error(`psql exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`));
    });
  });
};

const addDirIfExists = (archive, dir, dest) => {
  if (!dir || !fs.existsSync(dir)) return;
  archive.directory(dir, dest, { date: new Date() });
};

const addFileIfExists = (archive, filePath, destName) => {
  if (!filePath || !fs.existsSync(filePath)) return;
  archive.file(filePath, { name: destName, date: new Date() });
};

const backupMetaPath = (filePath) => {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${META_SUFFIX}`);
};

export const listBackups = async () => {
  const cfg = await loadBackupConfig();
  const targets = [
    { key: "local", dir: cfg.local_path },
    { key: "nas", dir: cfg.nas_path },
  ];
  const results = [];

  for (const t of targets) {
    if (!t.dir) continue;
    const dir = path.resolve(t.dir);
    if (!fs.existsSync(dir)) continue;
    const files = await fs.promises.readdir(dir);
    for (const file of files) {
      if (!file.endsWith(".zip")) continue;
      const full = path.join(dir, file);
      const metaFile = backupMetaPath(full);
      let meta = null;
      try {
        const raw = await fs.promises.readFile(metaFile, "utf8");
        meta = JSON.parse(raw);
      } catch {
        meta = null;
      }
      const stats = await fs.promises.stat(full);
      results.push({
        id: meta?.id || path.parse(file).name,
        filename: file,
        path: full,
        target: t.key,
        created_at: meta?.created_at || stats.mtime.toISOString(),
        size: stats.size,
        includes: meta?.includes || { db: true, files: true, env: true },
      });
    }
  }

  return results.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
};

const resolveTargetDir = (target, cfg) => {
  if (target === "nas") {
    if (!cfg.nas_path) throw new Error("NAS-Pfad ist nicht konfiguriert.");
    return path.resolve(cfg.nas_path);
  }
  return path.resolve(cfg.local_path || DEFAULT_LOCAL_PATH);
};

const ensureTargetDir = async (target, cfg) => {
  const dir = resolveTargetDir(target, cfg);
  await writeableTest(dir);
  return dir;
};

export const createBackup = async ({ target = "local", include_db = true, include_files = true, include_env = true } = {}) => {
  const cfg = await loadBackupConfig();
  const dir = await ensureTargetDir(target, cfg);
  const id = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const filename = `backup-${id}.zip`;
  const backupPath = path.join(dir, filename);

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "rechnungsapp-backup-"));
  const cleanup = async () => fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

  try {
    const pdf = await getPdfSettings();
    const pdfPaths = {
      storage: pdf.storage_path ? path.resolve(pdf.storage_path) : null,
      archive: pdf.archive_path ? path.resolve(pdf.archive_path) : null,
      trash: pdf.trash_path ? path.resolve(pdf.trash_path) : null,
    };

    let dbDumpPath = null;
    if (include_db) {
      dbDumpPath = path.join(tmpDir, "db.sql");
      await runPgDump(dbDumpPath);
    }

    const meta = {
      id,
      filename,
      created_at: new Date().toISOString(),
      target,
      includes: { db: include_db, files: include_files, env: include_env },
      pdf_paths: pdfPaths,
      env_files: {
        root: path.resolve(ROOT_DIR, "..", ".env"),
        backend: path.resolve(ROOT_DIR, ".env"),
      },
      version: resolveBuildInfo(),
    };

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(backupPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", resolve);
      output.on("error", reject);
      archive.on("error", reject);
      archive.pipe(output);

      archive.append(JSON.stringify(meta, null, 2), { name: "metadata.json" });

      if (include_db && dbDumpPath) {
        archive.file(dbDumpPath, { name: "db.sql" });
      }

      if (include_env) {
        addFileIfExists(archive, path.resolve(ROOT_DIR, "..", ".env"), "env/root.env");
        addFileIfExists(archive, path.resolve(ROOT_DIR, ".env"), "env/backend.env");
      }

      if (include_files) {
        addDirIfExists(archive, pdfPaths.storage, "files/pdfs/active");
        addDirIfExists(archive, pdfPaths.archive, "files/pdfs/archive");
        addDirIfExists(archive, pdfPaths.trash, "files/pdfs/trash");
        addDirIfExists(archive, path.resolve(ROOT_DIR, "public", "logos"), "branding/logos");
        addFileIfExists(archive, path.resolve(ROOT_DIR, "public", "favicon.ico"), "branding/favicon.ico");
      }

      archive.finalize();
    });

    const stats = await fs.promises.stat(backupPath);
    const metaFile = backupMetaPath(backupPath);
    await fs.promises.writeFile(metaFile, JSON.stringify({
      ...meta,
      size: stats.size,
    }, null, 2));

    return {
      id,
      filename,
      target,
      path: backupPath,
      created_at: meta.created_at,
      size: stats.size,
      includes: meta.includes,
    };
  } finally {
    await cleanup();
  }
};

export const getBackupPath = async ({ name, target }) => {
  const cfg = await loadBackupConfig();
  const dir = resolveTargetDir(target || cfg.default_target || "local", cfg);
  const safeName = path.basename(name);
  const full = path.join(dir, safeName);
  const rel = path.relative(dir, full);
  if (rel.startsWith("..")) throw new Error("Ungültiger Dateiname.");
  return full;
};

export const restoreBackup = async ({ name, target = "local", restore_db = true, restore_files = true, restore_env = false } = {}) => {
  const backupPath = await getBackupPath({ name, target });
  if (!fs.existsSync(backupPath)) throw new Error("Backup nicht gefunden.");

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "rechnungsapp-restore-"));
  const cleanup = async () => fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(backupPath)
        .pipe(unzipper.Extract({ path: tmpDir }))
        .on("error", reject)
        .on("close", resolve);
    });

    const metaPath = path.join(tmpDir, "metadata.json");
    let meta = null;
    try {
      const raw = await fs.promises.readFile(metaPath, "utf8");
      meta = JSON.parse(raw);
    } catch {
      meta = null;
    }

    if (restore_env) {
      const rootEnv = path.join(tmpDir, "env", "root.env");
      const backendEnv = path.join(tmpDir, "env", "backend.env");
      if (fs.existsSync(rootEnv)) {
        await fs.promises.copyFile(rootEnv, path.resolve(ROOT_DIR, "..", ".env"));
      }
      if (fs.existsSync(backendEnv)) {
        await fs.promises.copyFile(backendEnv, path.resolve(ROOT_DIR, ".env"));
      }
    }

    if (restore_files) {
      const pdfSettings = await getPdfSettings();
      const targets = {
        active: pdfSettings.storage_path ? path.resolve(pdfSettings.storage_path) : null,
        archive: pdfSettings.archive_path ? path.resolve(pdfSettings.archive_path) : null,
        trash: pdfSettings.trash_path ? path.resolve(pdfSettings.trash_path) : null,
      };
      const sourceBase = path.join(tmpDir, "files", "pdfs");
      await ensureDir(targets.active || path.resolve("/tmp/pdf-restore"));
      const copyDir = async (from, to) => {
        if (!from || !fs.existsSync(from) || !to) return;
        await ensureDir(to);
        await fs.promises.cp(from, to, { recursive: true, force: true });
      };
      await copyDir(path.join(sourceBase, "active"), targets.active);
      await copyDir(path.join(sourceBase, "archive"), targets.archive);
      await copyDir(path.join(sourceBase, "trash"), targets.trash);

      const brandingBase = path.join(tmpDir, "branding");
      const logosSrc = path.join(brandingBase, "logos");
      const faviconSrc = path.join(brandingBase, "favicon.ico");
      if (fs.existsSync(logosSrc)) {
        await copyDir(logosSrc, path.resolve(ROOT_DIR, "public", "logos"));
      }
      if (fs.existsSync(faviconSrc)) {
        await ensureDir(path.resolve(ROOT_DIR, "public"));
        await fs.promises.copyFile(faviconSrc, path.resolve(ROOT_DIR, "public", "favicon.ico"));
      }
    }

    if (restore_db) {
      const sqlPath = path.join(tmpDir, "db.sql");
      if (!fs.existsSync(sqlPath)) throw new Error("DB-Dump nicht im Backup gefunden.");
      await runPgRestore(sqlPath);
    }

    return {
      ok: true,
      restored: {
        db: restore_db,
        files: restore_files,
        env: restore_env,
      },
      meta,
    };
  } finally {
    await cleanup();
  }
};

export const streamBackupFile = async ({ name, target = "local", res }) => {
  const backupPath = await getBackupPath({ name, target });
  if (!fs.existsSync(backupPath)) throw new Error("Backup nicht gefunden.");
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${path.basename(backupPath)}"`);
  return fs.createReadStream(backupPath);
};

export const deleteBackup = async ({ name, target = "local" }) => {
  const backupPath = await getBackupPath({ name, target });
  if (!fs.existsSync(backupPath)) throw new Error("Backup nicht gefunden.");
  const metaFile = backupMetaPath(backupPath);
  await fs.promises.unlink(backupPath).catch(() => {});
  if (fs.existsSync(metaFile)) await fs.promises.unlink(metaFile).catch(() => {});
  return { ok: true };
};

export const streamInvoicesArchive = async ({ res }) => {
  const pdf = await getPdfSettings();
  const pdfPaths = {
    storage: pdf.storage_path ? path.resolve(pdf.storage_path) : null,
    archive: pdf.archive_path ? path.resolve(pdf.archive_path) : null,
    trash: pdf.trash_path ? path.resolve(pdf.trash_path) : null,
  };
  const id = new Date().toISOString().replace(/[:]/g, "").slice(0, 15) + "Z";
  const filename = `invoices-${id}.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  return await new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", reject);
    archive.on("end", resolve);
    archive.pipe(res);
    addDirIfExists(archive, pdfPaths.storage, "pdfs/active");
    addDirIfExists(archive, pdfPaths.archive, "pdfs/archive");
    addDirIfExists(archive, pdfPaths.trash, "pdfs/trash");
    archive.finalize();
  });
};
