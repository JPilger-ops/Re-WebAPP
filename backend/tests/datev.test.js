import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/utils/db.js";

process.env.DATEV_EMAIL = "fallback@test.local";

const originalQuery = db.query;

beforeEach(() => {
  db.query = originalQuery;
});

afterEach(() => {
  db.query = originalQuery;
});

test("saveDatevSettings persists email via db", async () => {
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("RETURNING email")) {
      return { rows: [{ email: params[0], updated_at: new Date().toISOString() }] };
    }
    return { rows: [] };
  };

  const module = await import("../src/utils/datevSettings.js");
  module.resetDatevSettingsCache();
  const result = await module.saveDatevSettings({ email: "datev@example.com" });

  assert.equal(result.email, "datev@example.com");
  assert.ok(calls.some((c) => c.sql.includes("CREATE TABLE IF NOT EXISTS datev_settings")));
  assert.ok(calls.some((c) => c.sql.includes("RETURNING email")));
});

test("getDatevSettings falls back to env when DB returns null", async () => {
  db.query = async (sql) => {
    if (sql.includes("SELECT email FROM datev_settings")) {
      return { rows: [{ email: null }] };
    }
    return { rows: [] };
  };

  const { getDatevSettings, resetDatevSettingsCache } = await import("../src/utils/datevSettings.js");
  resetDatevSettingsCache();
  const settings = await getDatevSettings({ forceRefresh: true });

  assert.equal(settings.email, "fallback@test.local");
  assert.equal(settings.source, "env");
});

test("buildDatevRecipients adds BCC for DATEV", async () => {
  const { buildDatevRecipients } = await import("../src/utils/datevExport.js");
  const recipients = buildDatevRecipients("kunde@example.com", "datev@kanzlei.de", true);

  assert.equal(recipients.to, "kunde@example.com");
  assert.equal(recipients.bcc, "datev@kanzlei.de");
  assert.equal(recipients.includeDatev, true);
});

test("updateDatevExportStatus writes SENT status", async () => {
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [] };
  };

  const { updateDatevExportStatus, DATEV_STATUS } = await import("../src/utils/datevExport.js");
  await updateDatevExportStatus(7, DATEV_STATUS.SENT, null);

  const updateCall = calls.find(
    (c) => c.sql.includes("UPDATE invoices") && Array.isArray(c.params)
  );
  assert.ok(updateCall, "Update query should be executed");
  assert.deepEqual(updateCall.params, [DATEV_STATUS.SENT, null, 7]);
});
