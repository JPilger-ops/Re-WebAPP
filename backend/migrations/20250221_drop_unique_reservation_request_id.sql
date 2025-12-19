-- Allow multiple invoices per ReservationRequest by dropping the unique constraint
DROP INDEX IF EXISTS idx_invoices_reservation_request_id;

-- Recreate as non-unique (partial) index for lookup performance
CREATE INDEX IF NOT EXISTS idx_invoices_reservation_request_id
  ON invoices (reservation_request_id)
  WHERE reservation_request_id IS NOT NULL;
