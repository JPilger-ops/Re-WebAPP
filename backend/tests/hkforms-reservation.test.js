import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/server.js";
import { db } from "../src/utils/db.js";
import { prisma } from "../src/utils/prisma.js";
import { resetHkformsSettingsCache } from "../src/utils/hkformsSettings.js";

const originalQuery = db.query;
const originalPrisma = {
  invoicesFindFirst: prisma.invoices.findFirst,
  invoicesUpdateMany: prisma.invoices.updateMany,
  invoiceItemsFindFirst: prisma.invoice_items.findFirst,
};
const originalFetch = global.fetch;

const hkformsSettingsRow = () => ({
  base_url: "https://app.bistrottelegraph.de/api",
  organization: null,
  api_key: process.env.HKFORMS_SYNC_TOKEN,
});

const hkformsQueryStub = async (sql) => {
  if (sql.includes("hkforms_settings")) {
    return { rowCount: 1, rows: [hkformsSettingsRow()] };
  }
  return { rowCount: 0, rows: [] };
};

const resetPrismaMocks = () => {
  prisma.invoices.findFirst = originalPrisma.invoicesFindFirst;
  prisma.invoices.updateMany = originalPrisma.invoicesUpdateMany;
  prisma.invoice_items.findFirst = originalPrisma.invoiceItemsFindFirst;
};

const setPrismaGuardMocks = () => {
  prisma.invoices.findFirst = async () => {
    throw new Error("prisma.invoices.findFirst not mocked");
  };
  prisma.invoices.updateMany = async () => {
    throw new Error("prisma.invoices.updateMany not mocked");
  };
  prisma.invoice_items.findFirst = async () => null;
};

beforeEach(() => {
  db.query = hkformsQueryStub;
  setPrismaGuardMocks();
  global.fetch = async () => ({
    ok: true,
    text: async () => "",
    arrayBuffer: async () => new ArrayBuffer(0),
  });
  process.env.HKFORMS_SYNC_TOKEN = "test-token";
  resetHkformsSettingsCache();
});

afterEach(() => {
  db.query = originalQuery;
  resetPrismaMocks();
  global.fetch = originalFetch;
});

test("GET by-reservation returns 401 with invalid token", async () => {
  process.env.HKFORMS_SYNC_TOKEN = "expected-token";

  const res = await request(app)
    .get("/api/invoices/by-reservation/res-1/status")
    .set("X-HKFORMS-CRM-TOKEN", "wrong-token")
    .expect(401);

  assert.equal(res.body.message, "Unauthorized");
});

test("GET by-reservation returns 404 when not found", async () => {
  prisma.invoices.findFirst = async () => null;

  const res = await request(app)
    .get("/api/invoices/by-reservation/res-unknown/status")
    .set("X-HKFORMS-CRM-TOKEN", "test-token")
    .expect(404);

  assert.equal(res.body.message, "Rechnung nicht gefunden");
});

test("POST by-reservation returns 400 on invalid status", async () => {
  // Prisma should not be hit for invalid status
  prisma.invoices.findFirst = async () => {
    throw new Error("Unexpected prisma.invoices.findFirst call");
  };

  const res = await request(app)
    .post("/api/invoices/by-reservation/res-1/status")
    .set("X-HKFORMS-CRM-TOKEN", "test-token")
    .send({ status: "INVALID" })
    .expect(400);

  assert.match(res.body.message || "", /Ungültiger Status/);
});

test("POST by-reservation updates status and returns snapshot", async () => {
  prisma.invoices.findFirst = async () => ({
    id: 7,
    invoice_number: "2024001",
    reservation_request_id: "res-1",
    status_sent: false,
    status_sent_at: null,
    status_paid_at: null,
    overdue_since: null,
    external_reference: null,
  });
  prisma.invoices.updateMany = async () => ({ count: 1 });
  prisma.invoice_items.findFirst = async () => null;

  const res = await request(app)
    .post("/api/invoices/by-reservation/res-1/status")
    .set("X-HKFORMS-CRM-TOKEN", "test-token")
    .send({
      status: "PAID",
      sentAt: "2024-01-01T00:00:00.000Z",
      paidAt: "2024-01-02T00:00:00.000Z",
      reference: "HK-REF",
    })
    .expect(200);

  assert.equal(res.body.invoiceNumber, "2024001");
  assert.equal(res.body.reference, "HK-REF");
  assert.equal(res.body.statusPaidAt, "2024-01-02T00:00:00.000Z");
});

test("GET by-reservation returns snapshot", async () => {
  prisma.invoices.findFirst = async () => ({
    id: 3,
    invoice_number: "2024002",
    reservation_request_id: "res-2",
    status_sent: true,
    status_sent_at: "2024-02-01T00:00:00.000Z",
    status_paid_at: null,
    overdue_since: null,
    external_reference: "EXT-123",
  });

  const res = await request(app)
    .get("/api/invoices/by-reservation/res-2/status")
    .set("X-HKFORMS-CRM-TOKEN", "test-token")
    .expect(200);

  assert.equal(res.body.invoiceId, 3);
  assert.equal(res.body.reference, "EXT-123");
  assert.equal(res.body.invoiceNumber, "2024002");
});
