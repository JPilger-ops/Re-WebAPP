#!/usr/bin/env node
/**
 * Mail Parity Check (Safe-Mode)
 * Schritte:
 *  A) Login
 *  B) Kategorie anlegen mit Template + SMTP Feldern (write-only Pass optional)
 *  C) Kunde anlegen
 *  D) Rechnung anlegen mit Kategorie
 *  E) Email-Preview holen -> asserts: Subject enthält Invoice#, Body enthält Empfängername, Template-Marker sichtbar
 *  F) Optional Send nur bei Safe-Mode (EMAIL_SEND_DISABLED=1/true/yes oder EMAIL_REDIRECT_TO gesetzt oder CHECK_ALLOW_EMAIL=1)
 *  G) Cleanup (Invoice, Customer, Category)
 *
 * Env:
 *  CHECK_BASE_URL (oder CHECK_HOST/CHECK_PORT)
 *  CHECK_USERNAME (default admin)
 *  CHECK_PASSWORD (default admin)
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
const allowEmail =
  ["1", "true", "yes"].includes((process.env.EMAIL_SEND_DISABLED || "").toLowerCase()) ||
  Boolean(process.env.EMAIL_REDIRECT_TO) ||
  ["1", "true", "yes"].includes((process.env.CHECK_ALLOW_EMAIL || "").toLowerCase());

const log = (...args) => console.log("[check:mail-parity]", ...args);

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

  let categoryId = null;
  let customerId = null;
  let invoiceId = null;

  try {
    // Logo fallback (optional)
    let logoFile = "";
    const { res: logosRes, data: logosData } = await fetchJson(`${baseUrl}/api/categories/logos`, {
      headers: { Cookie: cookie },
    });
    if (logosRes.status === 200 && Array.isArray(logosData) && logosData.length) {
      logoFile = logosData[0];
    }

    // Kategorie + Template + SMTP (pass optional)
    const categoryKey = `mail-cat-${suffix}`;
    const templateMarker = `TEMPLATE_MARK_${suffix}`;
    const { res: catRes, data: catData } = await fetchJson(`${baseUrl}/api/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ key: categoryKey, label: `Mail Cat ${suffix}`, logo_file: logoFile || "" }),
    });
    if (![200, 201].includes(catRes.status) || !catData?.id) throw new Error("Category create failed");
    categoryId = catData.id;
    log(`Category OK (${categoryKey})`);

    // Template setzen
    await fetchJson(`${baseUrl}/api/categories/${categoryId}/template`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        subject: `Rechnung {{invoice_number}} ${suffix}`,
        body_text: `${templateMarker} {{recipient_name}}`,
      }),
    });

    // SMTP (write-only pass optional) – nur setzen, falls ENDPOINT existiert
    await fetchJson(`${baseUrl}/api/categories/${categoryId}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        display_name: "Mail Parity",
        email_address: `mail-parity${suffix}@example.com`,
        smtp_host: "smtp.example.com",
        smtp_port: 587,
        smtp_secure: false,
        smtp_user: "user",
        smtp_pass: "pass",
      }),
    });

    // Customer
    const { data: custData } = await fetchJson(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        name: `Mail Kunde ${suffix}`,
        street: "Mail-Str 1",
        zip: "12345",
        city: "Mailstadt",
        email: `mail${suffix}@example.com`,
      }),
    });
    if (!custData?.id) throw new Error("Customer create failed");
    customerId = custData.id;
    log(`Customer OK (id=${customerId})`);

    // Invoice
    const invoiceNumber = `MAIL${suffix}`;
    const { data: invData } = await fetchJson(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        recipient: {
          name: `Mail Empf ${suffix}`,
          street: "Mail-Str 1",
          zip: "12345",
          city: "Mailstadt",
          email: `mail${suffix}@example.com`,
        },
        invoice: {
          invoice_number: invoiceNumber,
          date: new Date().toISOString().slice(0, 10),
          category: categoryKey,
          b2b: false,
        },
        items: [{ description: "Mail Position", quantity: 1, unit_price_gross: 9.99, vat_key: 1 }],
      }),
    });
    if (!invData?.invoice_id) throw new Error("Invoice create failed");
    invoiceId = invData.invoice_id;
    log(`Invoice OK (id=${invoiceId})`);

    // Preview
    const { res: prevRes, data: prevData } = await fetchJson(`${baseUrl}/api/invoices/${invoiceId}/email-preview`, {
      headers: { Cookie: cookie },
    });
    if (prevRes.status !== 200) throw new Error(`Preview failed (${prevRes.status})`);

    const subject = prevData?.subject || "";
    const bodyHtml = prevData?.body_html || "";
    const bodyText = prevData?.body_text || "";

    if (!subject.includes(invoiceNumber)) throw new Error("Subject missing invoice number");
    if (!(bodyText.includes(`Mail Empf ${suffix}`) || bodyHtml.includes(`Mail Empf ${suffix}`))) {
      throw new Error("Body missing recipient name");
    }
    if (!(bodyText.includes(templateMarker) || bodyHtml.includes(templateMarker))) {
      throw new Error("Template marker not found in preview");
    }
    log("Preview markers OK");

    // Optional Send in Safe Mode
    if (allowEmail) {
      const { res: sendRes, data: sendData } = await fetchJson(`${baseUrl}/api/invoices/${invoiceId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ to: `mail${suffix}@example.com`, include_datev: false }),
      });
      if (sendRes.status !== 200) throw new Error(`Send failed (${sendRes.status}): ${JSON.stringify(sendData)}`);
      log("Send OK (safe mode)");
    } else {
      log("Send skipped (not in safe mode)");
    }

    console.log("check:mail-parity OK");
    process.exit(0);
  } finally {
    // Cleanup
    const warn = (msg) => console.warn("[check:mail-parity][warn]", msg);
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
  console.error("check:mail-parity FAILED", err?.message || err);
  process.exit(1);
});
