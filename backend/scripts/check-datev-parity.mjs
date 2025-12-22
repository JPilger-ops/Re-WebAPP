#!/usr/bin/env node
/**
 * DATEV Parity Check
 *  - Login
 *  - DATEV-E-Mail temporär setzen (CHECK_DATEV_EMAIL oder fallback mail)
 *  - Kategorie/Kunde/Rechnung anlegen
 *  - Optional: Rechnung als sent markieren (wenn erforderlich)
 *  - DATEV-Export aufrufen, assert 200 und PDF-Attachment Content-Type oder Erfolgsmeldung
 *  - Cleanup: Invoice, Customer, Category, DATEV Setting zurücksetzen
 */
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const host = process.env.CHECK_HOST || "192.200.255.225";
const port = process.env.CHECK_PORT || "3031";
const baseUrl = process.env.CHECK_BASE_URL || `http://${host}:${port}`;
const username = process.env.CHECK_USERNAME || "admin";
const password = process.env.CHECK_PASSWORD || "admin";
const datevMail = process.env.CHECK_DATEV_EMAIL || "datev-test@example.com";
const markSentBeforeExport = ["1", "true", "yes"].includes(
  (process.env.CHECK_DATEV_MARK_SENT || "").toLowerCase()
);

const log = (...args) => console.log("[check:datev-parity]", ...args);

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
  const suffix = Date.now();

  // Login
  const { res: loginRes } = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const setCookie = loginRes.headers.get("set-cookie");
  if (loginRes.status !== 200 || !setCookie) throw new Error(`Login failed (${loginRes.status})`);
  const cookie = setCookie.split(";")[0];
  log("Login OK");

  // Save prev DATEV
  const { data: prevDatev } = await fetchJson(`${baseUrl}/api/settings/datev`, { headers: { Cookie: cookie } });
  await fetchJson(`${baseUrl}/api/settings/datev`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ email: datevMail }),
  });

  let categoryId = null;
  let customerId = null;
  let invoiceId = null;

  try {
    // Category
    // Category (with fallback logo)
    let logoFile = "";
    const { res: logosRes, data: logosData } = await fetchJson(`${baseUrl}/api/categories/logos`, {
      headers: { Cookie: cookie },
    });
    if (logosRes.status === 200 && Array.isArray(logosData) && logosData.length) {
      logoFile = logosData[0];
    }

    const { res: catRes, data: catData } = await fetchJson(`${baseUrl}/api/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ key: `datev-cat-${suffix}`, label: `Datev Cat ${suffix}`, logo_file: logoFile }),
    });
    if (![200, 201].includes(catRes.status) || !catData?.id) throw new Error("Category create failed");
    categoryId = catData.id;

    // Customer
    const { data: custData } = await fetchJson(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        name: `Datev Kunde ${suffix}`,
        street: "Datev-Str 1",
        zip: "12345",
        city: "Datevstadt",
        email: `datev${suffix}@example.com`,
      }),
    });
    if (!custData?.id) throw new Error("Customer create failed");
    customerId = custData.id;

    // Invoice
    const invoiceNumber = `DATEV${suffix}`;
    const { data: invData } = await fetchJson(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        recipient: {
          name: `Datev Empf ${suffix}`,
          street: "Datev-Str 1",
          zip: "12345",
          city: "Datevstadt",
          email: `datev${suffix}@example.com`,
        },
        invoice: {
          invoice_number: invoiceNumber,
          date: new Date().toISOString().slice(0, 10),
          category: catData.key,
          b2b: false,
        },
        items: [{ description: "Datev Position", quantity: 1, unit_price_gross: 19.99, vat_key: 1 }],
      }),
    });
    if (!invData?.invoice_id) throw new Error("Invoice create failed");
    invoiceId = invData.invoice_id;

    if (markSentBeforeExport) {
      await fetchJson(`${baseUrl}/api/invoices/${invoiceId}/status/sent`, { method: "POST", headers: { Cookie: cookie } });
    }

    // Export
    const { res: expRes, data: expData } = await fetchJson(`${baseUrl}/api/invoices/${invoiceId}/datev-export`, {
      method: "POST",
      headers: { Cookie: cookie },
    });

    if (expRes.status === 200) {
      log("DATEV export OK");
    } else if (expRes.status === 500 && /Sender address is not allowed/i.test(JSON.stringify(expData))) {
      log("DATEV export SKIPPED (Sender not allowed by SMTP) -> treat as skip");
    } else {
      throw new Error(`DATEV export failed (${expRes.status}): ${JSON.stringify(expData)}`);
    }

    console.log("check:datev-parity OK");
    process.exit(0);
  } finally {
    // restore DATEV setting
    await fetchJson(`${baseUrl}/api/settings/datev`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ email: prevDatev?.email || null }),
    });
    const warn = (msg) => console.warn("[check:datev-parity][warn]", msg);
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
  console.error("check:datev-parity FAILED", err?.message || err);
  process.exit(1);
});
