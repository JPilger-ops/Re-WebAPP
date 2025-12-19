import { db } from "../utils/db.js";
import { sendHkformsStatus } from "../utils/hkformsSync.js";

const DEFAULT_DAYS = 14;
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // alle 15 Minuten prüfen

async function fetchFirstItemDescription(invoiceId) {
  if (!invoiceId) return null;
  const res = await db.query(
    `
      SELECT description
      FROM invoice_items
      WHERE invoice_id = $1
      ORDER BY id ASC
      LIMIT 1
    `,
    [invoiceId]
  );
  return res.rows?.[0]?.description || null;
}

async function markOverdueAndSync() {
  const days = Number(process.env.OVERDUE_DAYS || DEFAULT_DAYS);
  if (!Number.isFinite(days) || days <= 0) return;

  const candidates = await db.query(
    `
      WITH due AS (
        SELECT id, invoice_number, reservation_request_id
        FROM invoices
        WHERE reservation_request_id IS NOT NULL
          AND status_sent = true
          AND status_paid_at IS NULL
          AND (overdue_since IS NULL)
          AND status_sent_at <= NOW() - $1::interval
        LIMIT 50
      )
      UPDATE invoices i
      SET overdue_since = COALESCE(i.overdue_since, NOW())
      FROM due d
      WHERE i.id = d.id
      RETURNING i.id, i.invoice_number, i.reservation_request_id, i.overdue_since
    `,
    [`${days} days`]
  );

  for (const row of candidates.rows || []) {
    try {
      const firstItem = await fetchFirstItemDescription(row.id);
      await sendHkformsStatus({
        reservationId: row.reservation_request_id,
        payload: {
          status: "OVERDUE",
          reference: row.invoice_number,
          overdueSince: row.overdue_since,
          firstItem: firstItem || null,
        },
        endpoint: "invoices",
      });
    } catch (err) {
      console.warn("[overdue-job] Sync error:", err?.message || err);
    }
  }
}

export function startOverdueJob() {
  const disabled = (process.env.OVERDUE_JOB_ENABLED || "true").toLowerCase() === "false";
  if (disabled) {
    console.log("[overdue-job] Disabled via OVERDUE_JOB_ENABLED=false");
    return;
  }

  if ((process.env.NODE_ENV || "").toLowerCase() === "test") {
    console.log("[overdue-job] Skipping in test environment");
    return;
  }

  const intervalMs = Number(process.env.OVERDUE_JOB_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    console.log("[overdue-job] Invalid interval, skipping");
    return;
  }

  // Sofort einmal ausführen, dann regelmäßig
  markOverdueAndSync().catch((err) =>
    console.warn("[overdue-job] Initial run failed:", err?.message || err)
  );

  setInterval(() => {
    markOverdueAndSync().catch((err) =>
      console.warn("[overdue-job] Interval run failed:", err?.message || err)
    );
  }, intervalMs);
}
