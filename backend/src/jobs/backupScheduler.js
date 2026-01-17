import { createBackup, ensureNfsMounted, loadBackupConfig, saveBackupConfig } from "../utils/backup.js";

const MIN_INTERVAL_MINUTES = 15;
let timer = null;

const clearTimer = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
};

const autoMountOnStartup = async () => {
  const cfg = await loadBackupConfig();
  const nfs = cfg.nfs || {};
  if (!nfs.enabled || nfs.auto_mount === false) return;
  try {
    await ensureNfsMounted(cfg);
    console.log("[backup] NFS Auto-Mount aktiviert.");
  } catch (err) {
    console.error("[backup] NFS Auto-Mount fehlgeschlagen:", err?.message || err);
  }
};

const scheduleNext = async () => {
  clearTimer();
  const cfg = await loadBackupConfig();
  const auto = cfg.auto || {};
  if (!auto.enabled) return;
  const interval = Math.max(Number(auto.interval_minutes) || 0, MIN_INTERVAL_MINUTES);
  const nextAt = new Date(Date.now() + interval * 60 * 1000);
  await saveBackupConfig({
    auto: {
      ...auto,
      next_run_at: nextAt.toISOString(),
    },
  });
  timer = setTimeout(() => {
    runAutoBackup().catch((err) => console.error("[backup] auto run failed:", err));
  }, interval * 60 * 1000);
};

export const runAutoBackup = async () => {
  clearTimer();
  const cfg = await loadBackupConfig();
  const auto = cfg.auto || {};
  if (!auto.enabled) {
    return;
  }
  try {
    const resolvedTarget =
      auto.target === "nas" ? "nas" : auto.target === "local" ? "local" : cfg.default_target === "nas" ? "nas" : "local";
    let effectiveTarget = resolvedTarget;
    if (resolvedTarget === "nas") {
      const nasPath = (cfg?.nas_path || "").trim();
      if (!nasPath) {
        console.warn("[backup] NAS-Pfad fehlt, Auto-Backup nutzt lokalen Speicher.");
        effectiveTarget = "local";
      } else if (cfg?.nfs?.auto_mount !== false) {
        try {
          await ensureNfsMounted(cfg);
        } catch (err) {
          console.error("[backup] nfs mount failed:", err?.message || err);
          console.warn("[backup] Auto-Backup nutzt lokalen Speicher als Fallback.");
          effectiveTarget = "local";
        }
      }
    }
    await createBackup({
      target: effectiveTarget === "nas" ? "nas" : "local",
      include_db: Boolean(auto.include_db),
      include_files: Boolean(auto.include_files),
      include_env: Boolean(auto.include_env),
    });
    await saveBackupConfig({
      auto: {
        ...auto,
        last_run_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[backup] auto backup failed:", err?.message || err);
  } finally {
    await scheduleNext();
  }
};

export const startBackupScheduler = async () => {
  await autoMountOnStartup();
  await scheduleNext();
};

export const reloadBackupScheduler = async () => {
  await scheduleNext();
};
