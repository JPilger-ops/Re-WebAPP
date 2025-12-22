#!/usr/bin/env node
/**
 * Parity Check (dev_DOCKER vs dev_Prisma)
 * Reproduziert kritische Flows:
 *  A) Login
 *  B) Kategorie anlegen (inkl. Logo-Upload)
 *  C) Kunde anlegen
 *  D) Rechnung anlegen (mit Kategorie/Kunde)
 *  E) PDF laden (>0 Bytes)
 *  F) PDF regenerate -> erneut laden (>0 Bytes)
 *  G) Email Preview (subject + body vorhanden)
 *  H) Email Send nur wenn sicher: EMAIL_SEND_DISABLED=1/true/yes oder EMAIL_REDIRECT_TO gesetzt oder CHECK_ALLOW_EMAIL=1
 *  I) DATEV Export: versucht, 200 zu bekommen; sonst Warnung
 *  J) Cleanup: Rechnung, Kunde, Kategorie löschen (Warnung, wenn nicht möglich)
 *
 * Env:
 *  CHECK_BASE_URL (z.B. http://192.200.255.225:3031)
 *  CHECK_HOST (default 192.200.255.225)
 *  CHECK_PORT (default 3031)
 *  CHECK_USERNAME (default admin)
 *  CHECK_PASSWORD (default admin)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

const host = process.env.CHECK_HOST || "192.200.255.225";
const port = process.env.CHECK_PORT || "3031";
const baseUrl = process.env.CHECK_BASE_URL || `http://${host}:${port}`;
const username = process.env.CHECK_USERNAME || "admin";
const password = process.env.CHECK_PASSWORD || "admin";

const allowEmail =
  ["1", "true", "yes"].includes((process.env.EMAIL_SEND_DISABLED || "").toLowerCase()) ||
  Boolean(process.env.EMAIL_REDIRECT_TO) ||
  ["1", "true", "yes"].includes((process.env.CHECK_ALLOW_EMAIL || "").toLowerCase());

const log = (...args) => console.log("[check:parity]", ...args);

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

(async () => {
  log(`Base URL: ${baseUrl}`);

  // A) Login
  const { res: loginRes } = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const setCookie = loginRes.headers.get("set-cookie");
  if (loginRes.status !== 200 || !setCookie) {
    throw new Error(`Login failed (${loginRes.status}), missing cookie`);
  }
  const cookie = setCookie.split(";")[0];
  log("Login OK");

  const suffix = Date.now();

  // B) Kategorie + Logo
  let logoFile = null;
  const tinySvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#4f46e5"/></svg>`
  ).toString("base64");
  const logoPayload = {
    filename: `parity-${suffix}.svg`,
    dataUrl: `data:image/svg+xml;base64,${tinySvg}`,
  };
  const { res: logoRes, data: logoData } = await fetchJson(`${baseUrl}/api/categories/logo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(logoPayload),
  });
  if (logoRes.status === 200 && logoData?.filename) {
    logoFile = logoData.filename;
  } else {
    const { res: logosRes, data: logosData } = await fetchJson(`${baseUrl}/api/categories/logos`, {
      headers: { Cookie: cookie },
    });
    if (logosRes.status === 200 && Array.isArray(logosData) && logosData.length) {
      logoFile = logosData[0];
      log(`Logo upload failed (${logoRes.status}), fallback to existing logo ${logoFile}`);
    } else {
      throw new Error(`Logo upload failed (${logoRes.status}): ${JSON.stringify(logoData)}`);
    }
  }
  const categoryKey = `parity-cat-${suffix}`;
  const categoryLabel = `Parity Cat ${suffix}`;
  const { res: catRes, data: catData } = await fetchJson(`${baseUrl}/api/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ key: categoryKey, label: categoryLabel, logo_file: logoFile }),
  });
  if (! [200,201].includes(catRes.status) || !catData?.id) {
    throw new Error(`Category create failed (${catRes.status}): ${JSON.stringify(catData)}`);
  }
  const categoryId = catData.id;
  log(`Category OK (${categoryKey})`);

  // C) Customer
  const { res: custRes, data: custData } = await fetchJson(`${baseUrl}/api/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      name: `Parity Kunde ${suffix}`,
      street: "Parity-Str 1",
      zip: "12345",
      city: "Paritystadt",
      email: `parity${suffix}@example.com`,
      phone: "000",
    }),
  });
  if (![200, 201].includes(custRes.status) || !custData?.id) {
    throw new Error(`Customer create failed (${custRes.status}): ${JSON.stringify(custData)}`);
  }
  const customerId = custData.id;
  log(`Customer OK (id=${customerId})`);

  // D) Invoice
  const invoiceNumber = `PAR${suffix}`;
  const { res: invRes, data: invData } = await fetchJson(`${baseUrl}/api/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      recipient: {
        name: `Parity Empf ${suffix}`,
        street: "Parity-Str 1",
        zip: "12345",
        city: "Paritystadt",
        email: `parity${suffix}@example.com`,
        phone: "000",
      },
      invoice: {
        invoice_number: invoiceNumber,
        date: new Date().toISOString().slice(0, 10),
        category: categoryKey,
        b2b: false,
      },
      items: [
        { description: "Parity Position", quantity: 1, unit_price_gross: 12.5, vat_key: 1 },
      ],
    }),
  });
  if (invRes.status !== 201 || !invData?.invoice_id) {
    throw new Error(`Invoice create failed (${invRes.status}): ${JSON.stringify(invData)}`);
  }
  const invoiceId = invData.invoice_id;
  log(`Invoice OK (id=${invoiceId})`);

  // E) PDF fetch
  const { res: pdfRes, buf: pdfBuf } = await fetchBuffer(`${baseUrl}/api/invoices/${invoiceId}/pdf`, {
    headers: { Cookie: cookie },
  });
  if (pdfRes.status !== 200) throw new Error(`PDF fetch failed (${pdfRes.status})`);
  if (!pdfBuf.length) throw new Error("PDF empty");
  log(`PDF fetched (${pdfBuf.length} bytes)`);

  // F) Regenerate + refetch
  const { res: regenRes, data: regenData } = await fetchJson(
    `${baseUrl}/api/invoices/${invoiceId}/pdf/regenerate`,
    { method: "POST", headers: { Cookie: cookie } }
  );
  if (regenRes.status !== 200) throw new Error(`Regenerate failed (${regenRes.status}): ${JSON.stringify(regenData)}`);
  const { res: pdf2Res, buf: pdf2Buf } = await fetchBuffer(`${baseUrl}/api/invoices/${invoiceId}/pdf`, {
    headers: { Cookie: cookie },
  });
  if (pdf2Res.status !== 200 || !pdf2Buf.length) throw new Error("PDF after regenerate invalid");
  log(`Regenerate OK (${pdf2Buf.length} bytes)`);

  // G) Email preview
  const { res: prevRes, data: prevData } = await fetchJson(
    `${baseUrl}/api/invoices/${invoiceId}/email-preview`,
    { headers: { Cookie: cookie } }
  );
  if (prevRes.status !== 200) throw new Error(`Email preview failed (${prevRes.status})`);
  if (!prevData?.subject || (!prevData?.body_html && !prevData?.body_text)) {
    throw new Error("Email preview missing subject/body");
  }
  log("Email preview OK");

  // H) Email send (safe only)
  if (allowEmail) {
    const { res: sendRes, data: sendData } = await fetchJson(
      `${baseUrl}/api/invoices/${invoiceId}/send-email`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ to: `parity${suffix}@example.com`, include_datev: false }),
      }
    );
    if (sendRes.status !== 200) throw new Error(`Email send failed (${sendRes.status}): ${JSON.stringify(sendData)}`);
    log("Email send OK (safe mode)");
  } else {
    log("Email send skipped (EMAIL_SEND_DISABLED/REDIRECT not set, and CHECK_ALLOW_EMAIL not enabled)");
  }

  // I) DATEV export
  const { res: datevRes } = await fetchJson(`${baseUrl}/api/invoices/${invoiceId}/datev-export`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  if (datevRes.status === 200) {
    log("DATEV export OK");
  } else {
    log(`DATEV export skipped/warn (status ${datevRes.status})`);
  }

  // J) Cleanup
  const warn = (msg) => console.warn("[check:parity][warn]", msg);
  const delInvoice = await fetch(`${baseUrl}/api/invoices/${invoiceId}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  if (delInvoice.status === 200) log("Invoice delete OK");
  else warn(`Invoice delete status ${delInvoice.status}`);

  const delCustomer = await fetch(`${baseUrl}/api/customers/${customerId}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  if (delCustomer.status === 200) log("Customer delete OK");
  else warn(`Customer delete status ${delCustomer.status}`);

  const delCategory = await fetch(`${baseUrl}/api/categories/${categoryId}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  if (delCategory.status === 200) log("Category delete OK");
  else warn(`Category delete status ${delCategory.status}`);

  console.log("check:parity OK");
  process.exit(0);
})().catch((err) => {
  console.error("check:parity FAILED", err?.message || err);
  process.exit(1);
});
