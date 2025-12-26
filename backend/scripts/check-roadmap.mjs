#!/usr/bin/env node
/**
 * Roadmap Checkpack
 * Führt die wichtigsten automatischen Checks aus und ergänzt Roadmap-spezifische Verifikationen.
 *
 * Env:
 *  CHECK_BASE_URL (default http://192.200.255.225:3031)
 *  CHECK_HOST / CHECK_PORT alternative
 *  CHECK_USERNAME / CHECK_PASSWORD (default admin/admin)
 *  CHECK_ALLOW_EMAIL (setzt mail send in parity checks frei, falls global disabled)
 */

import { execSync } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

const host = process.env.CHECK_HOST || "192.200.255.225";
const port = process.env.CHECK_PORT || "3031";
const baseUrl = process.env.CHECK_BASE_URL || `http://${host}:${port}`;
const username = process.env.CHECK_USERNAME || "admin";
const password = process.env.CHECK_PASSWORD || "admin";

const results = [];
const log = (...args) => console.log("[check:roadmap]", ...args);

const record = (name, ok, info = "") => {
  results.push({ name, ok, info });
  const icon = ok ? "✅" : "❌";
  log(`${icon} ${name} ${info ? `- ${info}` : ""}`);
};

const fetchJson = async (url, opts = {}) => {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data };
};

const fetchBuffer = async (url, opts = {}) => {
  const res = await fetch(url, opts);
  const buf = Buffer.from(await res.arrayBuffer());
  return { res, buf };
};

const runScript = (cmd, name) => {
  try {
    execSync(cmd, { stdio: "inherit" });
    record(name, true);
  } catch (err) {
    record(name, false, err?.message || err);
  }
};

const login = async () => {
  const { res } = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  if (res.status !== 200 || !cookie) throw new Error(`Login fehlgeschlagen (${res.status})`);
  return cookie;
};

const unauthShould401 = async () => {
  const { res } = await fetchJson(`${baseUrl}/api/auth/me`);
  return res.status === 401;
};

const main = async () => {
  log(`Base URL: ${baseUrl}`);

  // Existing smoke scripts
  runScript("npm --prefix backend run check:api", "check:api");
  runScript("npm --prefix backend run check:pdf", "check:pdf");
  runScript("npm --prefix backend run check:invoice", "check:invoice");

  // Optional parity packs (best-effort)
  runScript("npm --prefix backend run check:parity", "check:parity");
  runScript("npm --prefix backend run check:pdf-parity", "check:pdf-parity");
  runScript("npm --prefix backend run check:mail-parity", "check:mail-parity");
  runScript("npm --prefix backend run check:datev-parity", "check:datev-parity");
  runScript("npm --prefix backend run check:hkforms-parity", "check:hkforms-parity");

  // Auth / redirect expectation
  try {
    const unauth = await unauthShould401();
    record("auth unauthenticated 401", unauth, unauth ? "" : "expected 401");
  } catch (err) {
    record("auth unauthenticated 401", false, err?.message || err);
  }

  let cookie = null;
  try {
    cookie = await login();
    record("login", true);
  } catch (err) {
    record("login", false, err?.message || err);
    summary();
    process.exit(1);
  }

  // Network settings roundtrip
  try {
    const { data: net0 } = await fetchJson(`${baseUrl}/api/settings/network`, { headers: { Cookie: cookie } });
    const original = net0 || { cors_origins: [], trust_proxy: true };
    // invalid origin should fail
    const bad = await fetchJson(`${baseUrl}/api/settings/network`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ cors_origins: ["*"], trust_proxy: original.trust_proxy }),
    });
    if (bad.res.ok) throw new Error("invalid origin was accepted");
    // valid update
    const extraOrigin = "http://localhost";
    const updated = await fetchJson(`${baseUrl}/api/settings/network`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ cors_origins: [...(original.cors_origins || []), extraOrigin], trust_proxy: original.trust_proxy }),
    });
    if (!updated.res.ok) throw new Error(`valid update failed (${updated.res.status})`);
    // restore
    await fetchJson(`${baseUrl}/api/settings/network`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ cors_origins: original.cors_origins || [], trust_proxy: original.trust_proxy }),
    });
    // diagnostics
    await fetchJson(`${baseUrl}/api/settings/network/diagnostics`, { headers: { Cookie: cookie } });
    record("network settings roundtrip", true);
  } catch (err) {
    record("network settings roundtrip", false, err?.message || err);
  }

  // Email templates roundtrip
  try {
    const { data: tmpl0 } = await fetchJson(`${baseUrl}/api/settings/email-templates`, { headers: { Cookie: cookie } });
    const original = tmpl0 || {};
    const marker = `Roadmap-${Date.now()}`;
    const put = await fetchJson(`${baseUrl}/api/settings/email-templates`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        subject_template: marker,
        body_html_template: original.body_html_template || "",
        body_text_template: original.body_text_template || "",
      }),
    });
    if (!put.res.ok) throw new Error(`template update failed (${put.res.status})`);
    const { data: tmpl1 } = await fetchJson(`${baseUrl}/api/settings/email-templates`, { headers: { Cookie: cookie } });
    if (tmpl1?.subject_template !== marker) throw new Error("template marker not persisted");
    // restore
    await fetchJson(`${baseUrl}/api/settings/email-templates`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        subject_template: original.subject_template || "Rechnung {{invoice_number}}",
        body_html_template: original.body_html_template || "",
        body_text_template: original.body_text_template || "",
      }),
    });
    record("email templates roundtrip", true);
  } catch (err) {
    record("email templates roundtrip", false, err?.message || err);
  }

  // Favicon reset (safe)
  try {
    const { res } = await fetchJson(`${baseUrl}/api/settings/favicon/reset`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    if (!res.ok) throw new Error(`reset failed (${res.status})`);
    record("favicon reset", true);
  } catch (err) {
    record("favicon reset", false, err?.message || err);
  }

  // Invoice flow with auto-number + HKForms ID
  try {
    const next = await fetchJson(`${baseUrl}/api/invoices/next-number`, { headers: { Cookie: cookie } });
    if (!next.res.ok || !next.data?.next_number) throw new Error("next-number missing");
    const { res: invRes, data: invData } = await fetchJson(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        recipient: { name: "Roadmap Kunde", email: "roadmap@example.com" },
        invoice: {
          invoice_number: "",
          date: new Date().toISOString().slice(0, 10),
          category: null,
          reservation_request_id: `HK-${Date.now()}`,
        },
        items: [{ description: "Roadmap Item", quantity: 1, unit_price_gross: 10, vat_key: 1 }],
      }),
    });
    if (invRes.status !== 201 || !invData?.invoice_id) throw new Error(`create failed (${invRes.status})`);
    const invId = invData.invoice_id;
    const detail = await fetchJson(`${baseUrl}/api/invoices/${invId}`, { headers: { Cookie: cookie } });
    if (!detail.res.ok || !detail.data?.invoice?.invoice_number) throw new Error("invoice_number missing after create");
    // PDF
    const pdf = await fetchBuffer(`${baseUrl}/api/invoices/${invId}/pdf`, { headers: { Cookie: cookie } });
    if (pdf.res.status !== 200 || !pdf.buf.length) throw new Error("pdf fetch failed");
    // regenerate
    const regen = await fetchJson(`${baseUrl}/api/invoices/${invId}/pdf/regenerate`, { method: "POST", headers: { Cookie: cookie } });
    if (!regen.res.ok) throw new Error("pdf regenerate failed");
    // DATEV (expect not 500)
    const datev = await fetchJson(`${baseUrl}/api/invoices/${invId}/datev`, { headers: { Cookie: cookie } });
    if (datev.res.status >= 500) throw new Error("DATEV export 5xx");
    // cleanup
    await fetchJson(`${baseUrl}/api/invoices/${invId}`, { method: "DELETE", headers: { Cookie: cookie } });
    record("invoice flow (auto-number + hkforms id)", true);
  } catch (err) {
    record("invoice flow (auto-number + hkforms id)", false, err?.message || err);
  }

  // Stats endpoint
  try {
    const stats = await fetchJson(`${baseUrl}/api/stats/invoices`, { headers: { Cookie: cookie } });
    if (!stats.res.ok) throw new Error(`stats failed (${stats.res.status})`);
    record("stats endpoint", true);
  } catch (err) {
    record("stats endpoint", false, err?.message || err);
  }

  // API keys create/revoke/delete
  try {
    const create = await fetchJson(`${baseUrl}/api/settings/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name: `roadmap-${Date.now()}` }),
    });
    if (!create.res.ok || !create.data?.id) throw new Error("create failed");
    const keyId = create.data.id;
    await fetchJson(`${baseUrl}/api/settings/api-keys/${keyId}/revoke`, { method: "POST", headers: { Cookie: cookie } });
    await fetchJson(`${baseUrl}/api/settings/api-keys/${keyId}`, { method: "DELETE", headers: { Cookie: cookie } });
    record("api keys create/revoke/delete", true);
  } catch (err) {
    record("api keys create/revoke/delete", false, err?.message || err);
  }

  // Note on idle logout (manual)
  record("idle logout (manual)", false, "Manuell prüfen: 5min Inaktivität -> Logout");

  summary();
};

const summary = () => {
  log("---- Summary ----");
  results.forEach((r) => {
    const icon = r.ok ? "✅" : "⚠️";
    log(`${icon} ${r.name}${r.info ? ` -> ${r.info}` : ""}`);
  });
};

main()
  .catch((err) => {
    record("check:roadmap fatal", false, err?.message || err);
    summary();
    process.exit(1);
  });
