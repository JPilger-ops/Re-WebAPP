#!/usr/bin/env node
/**
 * End-to-end Invoice smoke:
 * - Login (Cookie)
 * - Create invoice
 * - Fetch PDF (checks >0 bytes)
 * - Verify PDF file exists in backend/pdfs
 * - Delete invoice
 *
 * Env:
 *  CHECK_BASE_URL (e.g. http://192.200.255.225:3031)
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

const log = (...args) => console.log("[check:invoice]", ...args);

const fetchJson = async (url, opts = {}) => {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
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
  const loginBody = { username, password };
  const { res: loginRes } = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(loginBody),
  });
  const setCookie = loginRes.headers.get("set-cookie");
  if (loginRes.status !== 200 || !setCookie) {
    throw new Error(`Login failed (${loginRes.status}), missing cookie`);
  }
  const cookie = setCookie.split(";")[0];
  log("Login OK");

  const invoiceNumber = `CHK${Date.now()}`;
  const createBody = {
    recipient: {
      name: "Smoke Kunde",
      street: "Smoke-Str 1",
      zip: "12345",
      city: "Teststadt",
      email: "smoke@example.com",
      phone: "000",
    },
    invoice: {
      invoice_number: invoiceNumber,
      date: new Date().toISOString().slice(0, 10),
      category: "default",
      b2b: false,
    },
    items: [
      {
        description: "Smoke Item",
        quantity: 1,
        unit_price_gross: 10,
        vat_key: 1,
      },
    ],
  };

  // Create invoice
  const { res: createRes, data: createData } = await fetchJson(
    `${baseUrl}/api/invoices`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(createBody),
    }
  );
  if (createRes.status !== 201 || !createData?.invoice_id) {
    throw new Error(`Create failed (${createRes.status}): ${JSON.stringify(createData)}`);
  }
  const invoiceId = createData.invoice_id;
  log(`Create OK, id=${invoiceId}`);

  // Fetch PDF
  const pdfRes = await fetch(`${baseUrl}/api/invoices/${invoiceId}/pdf`, {
    headers: { Cookie: cookie },
  });
  if (pdfRes.status !== 200) {
    throw new Error(`PDF fetch failed (${pdfRes.status})`);
  }
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  if (pdfBuf.length === 0) throw new Error("PDF is empty");
  log(`PDF fetched (${pdfBuf.length} bytes)`);

  // Verify file on disk
  const pdfPath = path.join(rootDir, "pdfs", `RE-${invoiceNumber}.pdf`);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found on disk: ${pdfPath}`);
  }
  const stats = fs.statSync(pdfPath);
  if (stats.size === 0) throw new Error("PDF file on disk is empty");
  log(`PDF exists on disk (${stats.size} bytes)`);

  // Delete invoice
  const delRes = await fetch(`${baseUrl}/api/invoices/${invoiceId}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  if (delRes.status !== 200) {
    throw new Error(`Delete failed (${delRes.status})`);
  }
  log("Delete OK");

  console.log("check:invoice OK");
  process.exit(0);
})().catch((err) => {
  console.error("check:invoice FAILED", err.message || err);
  process.exit(1);
});
