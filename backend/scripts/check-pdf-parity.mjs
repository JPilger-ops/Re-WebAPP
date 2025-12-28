#!/usr/bin/env node
/**
 * PDF Parity Check (Marker-basiert, ohne OCR)
 * Schritte:
 *  - Login
 *  - Header/Bank Settings sichern und temporär auf Testwerte setzen
 *  - Kategorie + Kunde + Rechnung anlegen
 *  - PDF abrufen (>0 Bytes)
 *  - Regenerate PDF (>0 Bytes)
 *  - HTML vor dem Rendern erzeugen (generateInvoiceHtml) und Marker prüfen
 *  - Cleanup: Invoice, Customer, Category; Header/Bank Settings zurücksetzen
 *
 * Env:
 *  CHECK_BASE_URL (oder CHECK_HOST/CHECK_PORT)
 *  CHECK_USERNAME (default admin)
 *  CHECK_PASSWORD (default admin)
 */
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import { generateInvoiceHtml } from "../src/controllers/invoice.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const host = process.env.CHECK_HOST || "192.200.255.225";
const port = process.env.CHECK_PORT || "3031";
const baseUrl = process.env.CHECK_BASE_URL || `http://${host}:${port}`;
const username = process.env.CHECK_USERNAME || "admin";
const password = process.env.CHECK_PASSWORD || "admin";

const log = (...args) => console.log("[check:pdf-parity]", ...args);

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
  const suffix = Date.now();

  // Login
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

  // Save current settings
  const getSettings = async (url) => (await fetchJson(url, { headers: { Cookie: cookie } })).data || {};
  const putSettings = async (url, body) =>
    fetchJson(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    });

  const prevHeader = await getSettings(`${baseUrl}/api/settings/invoice-header`);
  const prevBank = await getSettings(`${baseUrl}/api/settings/bank`);

  // Set test header/bank values
  const testHeader = {
    company_name: "Parity Co.",
    address_line1: "Musterstr. 1",
    address_line2: "2. OG",
    zip: "12345",
    city: "Paritystadt",
    country: "DE",
    vat_id: "DE999999999",
    bank_name: "Parity Bank",
    iban: "DE12500105170648489890",
    bic: "PARITY99",
    footer_text: "Testfooter Parity",
    logo_url: "",
  };
  const testBank = {
    account_holder: "Parity Holder",
    bank_name: "Parity Bank",
    iban: "DE12500105170648489890",
    bic: "PARITY99",
  };

  await putSettings(`${baseUrl}/api/settings/invoice-header`, testHeader);
  await putSettings(`${baseUrl}/api/settings/bank`, testBank);
  log("Test Header/Bank gesetzt");

  let categoryId = null;
  let customerId = null;
  let invoiceId = null;

  try {
    // Kategorie + Logo
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
    const { data: catData } = await fetchJson(`${baseUrl}/api/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ key: categoryKey, label: `Parity Cat ${suffix}`, logo_file: logoFile }),
    });
    if (!catData?.id) throw new Error("Category create failed");
    categoryId = catData.id;
    log(`Category OK (${categoryKey})`);

    // Customer
    const { data: custData } = await fetchJson(`${baseUrl}/api/customers`, {
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
    if (!custData?.id) throw new Error("Customer create failed");
    customerId = custData.id;
    log(`Customer OK (id=${customerId})`);

    // Invoice
    const invoiceNumber = `PAR${suffix}`;
    const { data: invData } = await fetchJson(`${baseUrl}/api/invoices`, {
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
    if (!invData?.invoice_id) throw new Error("Invoice create failed");
    invoiceId = invData.invoice_id;
    log(`Invoice OK (id=${invoiceId})`);

    // PDF fetch
    const { res: pdfRes, buf: pdfBuf } = await fetchBuffer(`${baseUrl}/api/invoices/${invoiceId}/pdf`, {
      headers: { Cookie: cookie },
    });
    if (pdfRes.status !== 200 || !pdfBuf.length) throw new Error("PDF fetch failed/empty");
    log(`PDF fetched (${pdfBuf.length} bytes)`);

    // Regenerate
    const { res: regenRes } = await fetchJson(`${baseUrl}/api/invoices/${invoiceId}/pdf/regenerate`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    if (regenRes.status !== 200) throw new Error(`Regenerate failed (${regenRes.status})`);
    const { res: pdf2Res, buf: pdf2Buf } = await fetchBuffer(`${baseUrl}/api/invoices/${invoiceId}/pdf`, {
      headers: { Cookie: cookie },
    });
    if (pdf2Res.status !== 200 || !pdf2Buf.length) throw new Error("PDF after regenerate invalid");
    log(`Regenerate OK (${pdf2Buf.length} bytes)`);

    // Invoice detail for HTML generation
    const { data: invDetail } = await fetchJson(`${baseUrl}/api/invoices/${invoiceId}`, {
      headers: { Cookie: cookie },
    });
    if (!invDetail?.invoice || !Array.isArray(invDetail.items)) {
      throw new Error("Invoice detail missing");
    }
    const invoice = invDetail.invoice;
    const items = invDetail.items;

    // itemsRowsHtml
    const itemsRowsHtml = items
      .map((item) => {
        return `
          <tr>
            <td>${item.description}</td>
            <td style="text-align:right;"><span class="amount">${item.quantity}</span></td>
            <td style="text-align:right;"><span class="amount">${item.unit_price_gross} €</span></td>
            <td style="text-align:right;"><span class="amount">${item.line_total_gross || item.unit_price_gross} €</span></td>
          </tr>
        `;
      })
      .join("");

    // dummy sepa QR (Marker irrelevant)
    const sepaQrBase64 = await QRCode.toDataURL("TEST");

    const formattedDate = invoice.date ? new Date(invoice.date).toLocaleDateString("de-DE") : "";

    // Build HTML for marker check
    const html = generateInvoiceHtml(
      invoice,
      formattedDate,
      itemsRowsHtml,
      sepaQrBase64,
      "", // logoBase64
      testBank,
      testHeader
    );

    const ibanFormatted = testHeader.iban.replace(/(.{4})/g, "$1 ").trim();
    const markers = [
      { key: "company_name", value: testHeader.company_name },
      { key: "iban", value: ibanFormatted },
      { key: "bic", value: testHeader.bic },
      { key: "invoice_number", value: invoice.invoice_number },
      { key: "recipient_name", value: invoice.recipient.name },
      { key: "footer_text", value: testHeader.footer_text },
    ];

    const missing = markers.filter((m) => !html.includes(m.value));
    if (missing.length) {
      missing.forEach((m) => console.error(`[marker missing] ${m.key}: ${m.value}`));
      throw new Error("Marker fehlend im HTML");
    }
    log("Marker OK");

    console.log("check:pdf-parity OK");
  } finally {
    // Restore settings
    await putSettings(`${baseUrl}/api/settings/invoice-header`, prevHeader);
    await putSettings(`${baseUrl}/api/settings/bank`, prevBank);
    // Cleanup entities
    const warn = (msg) => console.warn("[check:pdf-parity][warn]", msg);
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
  process.exit(0);
})().catch((err) => {
  console.error("check:pdf-parity FAILED", err?.message || err);
  process.exit(1);
});
