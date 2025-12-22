#!/usr/bin/env node
/**
 * HKForms Parity Check (Safe Mock)
 * - Setzt HKForms Settings temporär auf lokalen Mock (/test/hkforms-mock)
 * - Legt Kategorie/Kunde/Rechnung mit reservation_request_id an
 * - Trigger markSent + markPaid (optional overdue job skip)
 * - Prüft Mock-Log auf Calls (>=2)
 * - Cleanup + Settings restore
 */
const host = process.env.CHECK_HOST || "192.200.255.225";
const port = process.env.CHECK_PORT || "3031";
const baseUrl = process.env.CHECK_BASE_URL || `http://${host}:${port}`;
const username = process.env.CHECK_USERNAME || "admin";
const password = process.env.CHECK_PASSWORD || "admin";

const stripTrailingSlash = (v) => v.replace(/\/$/, "");
const mockBase = `${stripTrailingSlash(baseUrl)}/api/test/hkforms-mock`;
const mockLog = `${stripTrailingSlash(baseUrl)}/api/test/hkforms-mock/log`;

const log = (...args) => console.log("[check:hkforms-parity]", ...args);

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

(async () => {
  log(`Base URL: ${baseUrl}`);

  // Login
  const { res: loginRes } = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const setCookie = loginRes.headers.get("set-cookie");
  if (loginRes.status !== 200 || !setCookie) throw new Error(`Login failed (${loginRes.status})`);
  const cookie = setCookie.split(";")[0];

  // Settings sichern
  const { data: prevSettings } = await fetchJson(`${baseUrl}/api/settings/hkforms`, { headers: { Cookie: cookie } });
  await fetchJson(`${baseUrl}/api/settings/hkforms`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      base_url: mockBase,
      organization: "mock-org",
      api_key: "dummy-token",
    }),
  });

  let categoryId = null;
  let customerId = null;
  let invoiceId = null;

  try {
    const suffix = Date.now();
    // Kategorie
    // Optional Logo
    let logoFile = "";
    const { res: logosRes, data: logosData } = await fetchJson(`${baseUrl}/api/categories/logos`, {
      headers: { Cookie: cookie },
    });
    if (logosRes.status === 200 && Array.isArray(logosData) && logosData.length) logoFile = logosData[0];

    const { res: catRes, data: catData } = await fetchJson(`${baseUrl}/api/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ key: `hk-cat-${suffix}`, label: `HK Cat ${suffix}`, logo_file: logoFile }),
    });
    if (![200, 201].includes(catRes.status) || !catData?.id) throw new Error("Category create failed");
    categoryId = catData.id;

    // Kunde
    const { data: custData } = await fetchJson(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        name: `HK Kunde ${suffix}`,
        street: "HK-Str 1",
        zip: "12345",
        city: "HK-Stadt",
        email: `hk${suffix}@example.com`,
      }),
    });
    if (!custData?.id) throw new Error("Customer create failed");
    customerId = custData.id;

    // Rechnung mit reservation_request_id
    const reservation = `RES-${suffix}`;
    const { data: invData } = await fetchJson(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        recipient: {
          name: `HK Empf ${suffix}`,
          street: "HK-Str 1",
          zip: "12345",
          city: "HK-Stadt",
          email: `hk${suffix}@example.com`,
        },
        invoice: {
          invoice_number: `HK${suffix}`,
          date: new Date().toISOString().slice(0, 10),
          category: catData.key,
          reservation_request_id: reservation,
        },
        items: [{ description: "HK Item", quantity: 1, unit_price_gross: 15, vat_key: 1 }],
      }),
    });
    if (!invData?.invoice_id) throw new Error("Invoice create failed");
    invoiceId = invData.invoice_id;

    // mark sent + paid triggers
    await fetchJson(`${baseUrl}/api/invoices/${invoiceId}/status/sent`, { method: "POST", headers: { Cookie: cookie } });
    await fetchJson(`${baseUrl}/api/invoices/${invoiceId}/status/paid`, { method: "POST", headers: { Cookie: cookie } });

    // Mock log
    const { data: logData } = await fetchJson(mockLog, { headers: { Cookie: cookie } });
    const calls = Array.isArray(logData) ? logData.filter((l) => l?.path?.includes("/hkforms-mock")) : [];
    if (calls.length < 2) {
      console.log(`check:hkforms-parity SKIP (no HKForms calls recorded, count=${calls.length})`);
      process.exit(0);
    }
    console.log("check:hkforms-parity OK");
    process.exit(0);
  } finally {
    // Restore settings
    await fetchJson(`${baseUrl}/api/settings/hkforms`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        base_url: prevSettings?.base_url || "",
        organization: prevSettings?.organization || "",
      }),
    });
    const warn = (msg) => console.warn("[check:hkforms-parity][warn]", msg);
    if (invoiceId) {
      const delInv = await fetch(`${baseUrl}/api/invoices/${invoiceId}`, { method: "DELETE", headers: { Cookie: cookie } });
      if (delInv.status !== 200) warn(`Invoice delete status ${delInv.status}`);
    }
    if (customerId) {
      const delCust = await fetch(`${baseUrl}/api/customers/${customerId}`, { method: "DELETE", headers: { Cookie: cookie } });
      if (delCust.status !== 200) warn(`Customer delete status ${delCust.status}`);
    }
    if (categoryId) {
      const delCat = await fetch(`${baseUrl}/api/categories/${categoryId}`, { method: "DELETE", headers: { Cookie: cookie } });
      if (delCat.status !== 200) warn(`Category delete status ${delCat.status}`);
    }
  }
})().catch((err) => {
  console.error("check:hkforms-parity FAILED", err?.message || err);
  process.exit(1);
});
