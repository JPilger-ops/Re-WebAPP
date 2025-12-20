import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/server.js";
import { db } from "../src/utils/db.js";
import { resetHkformsSettingsCache } from "../src/utils/hkformsSettings.js";

const originalQuery = db.query;
const hkformsSettingsRow = () => ({
  base_url: "https://app.bistrottelegraph.de/api",
  organization: null,
  api_key: process.env.HKFORMS_SYNC_TOKEN,
});

beforeEach(() => {
  db.query = originalQuery;
  process.env.HKFORMS_SYNC_TOKEN = "test-token";
  resetHkformsSettingsCache();
});

afterEach(() => {
  db.query = originalQuery;
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
  db.query = async (sql) => {
    if (sql.includes("hkforms_settings")) {
      return { rowCount: 1, rows: [hkformsSettingsRow()] };
    }
    return { rowCount: 0, rows: [] };
  };

  const res = await request(app)
    .get("/api/invoices/by-reservation/res-unknown/status")
    .set("X-HKFORMS-CRM-TOKEN", "test-token")
    .expect(404);

  assert.equal(res.body.message, "Rechnung nicht gefunden");
});

test("POST by-reservation returns 400 on invalid status", async () => {
  db.query = async (sql) => {
    if (sql.includes("hkforms_settings")) {
      return { rowCount: 1, rows: [hkformsSettingsRow()] };
    }
    throw new Error("DB should not be called for invalid status");
  };

  const res = await request(app)
    .post("/api/invoices/by-reservation/res-1/status")
    .set("X-HKFORMS-CRM-TOKEN", "test-token")
    .send({ status: "INVALID" })
    .expect(400);

  assert.match(res.body.message || "", /Ungültiger Status/);
});

test("POST by-reservation updates status and returns snapshot", async () => {
  db.query = async (sql) => {
    if (sql.includes("hkforms_settings")) {
      return { rowCount: 1, rows: [hkformsSettingsRow()] };
    }
    if (sql.includes("FROM invoices")) {
      return {
        rowCount: 1,
        rows: [
          {
            id: 7,
            invoice_number: "2024001",
            reservation_request_id: "res-1",
            status_sent: false,
            status_sent_at: null,
            status_paid_at: null,
            overdue_since: null,
            external_reference: null,
          },
        ],
      };
    }

    if (sql.includes("UPDATE invoices")) {
      return {
        rowCount: 1,
        rows: [
          {
            id: 7,
            invoice_number: "2024001",
            reservation_request_id: "res-1",
            status_sent: true,
            status_sent_at: "2024-01-01T00:00:00.000Z",
            status_paid_at: "2024-01-02T00:00:00.000Z",
            overdue_since: null,
            external_reference: "HK-REF",
          },
        ],
      };
    }

    if (sql.includes("FROM invoice_items")) {
      return { rowCount: 0, rows: [] };
    }

    throw new Error("Unexpected query: " + sql);
  };

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
  db.query = async (sql) => {
    if (sql.includes("hkforms_settings")) {
      return { rowCount: 1, rows: [hkformsSettingsRow()] };
    }
    return {
      rowCount: 1,
      rows: [
        {
          id: 3,
          invoice_number: "2024002",
          reservation_request_id: "res-2",
          status_sent: true,
          status_sent_at: "2024-02-01T00:00:00.000Z",
          status_paid_at: null,
          overdue_since: null,
          external_reference: "EXT-123",
        },
      ],
    };
  };

  const res = await request(app)
    .get("/api/invoices/by-reservation/res-2/status")
    .set("X-HKFORMS-CRM-TOKEN", "test-token")
    .expect(200);

  assert.equal(res.body.invoiceId, 3);
  assert.equal(res.body.reference, "EXT-123");
  assert.equal(res.body.invoiceNumber, "2024002");
});
