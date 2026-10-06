-- Payment gateway idempotency and payment provider identity.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_payment_id
  ON payments(payment_id) WHERE payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  order_id TEXT,
  payment_id TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
