import { createBackup, ensureNfsMounted, loadBackupConfig, saveBackupConfig } from "../utils/backup.js";

const MIN_INTERVAL_MINUTES = 15;
let timer = null;

const clearTimer = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
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
    if (auto.target === "nas" && cfg?.nfs?.auto_mount !== false) {
      await ensureNfsMounted(cfg);
    }
    await createBackup({
      target: auto.target === "nas" ? "nas" : "local",
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
  await scheduleNext();
};

export const reloadBackupScheduler = async () => {
  await scheduleNext();
};
