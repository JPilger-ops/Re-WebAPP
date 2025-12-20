-- Adds optional reservation / external reference fields for HKForms sync
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS reservation_request_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS external_reference TEXT,
  ADD COLUMN IF NOT EXISTS overdue_since TIMESTAMP;

-- Partial unique index to keep ReservationRequest.id 1:1 when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_reservation_request_id
  ON invoices (reservation_request_id)
  WHERE reservation_request_id IS NOT NULL;
