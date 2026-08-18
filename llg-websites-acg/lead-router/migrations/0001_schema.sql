CREATE TABLE IF NOT EXISTS site_routes (
  site_key TEXT PRIMARY KEY,
  brand_name TEXT NOT NULL,
  routing_status TEXT NOT NULL CHECK (routing_status IN ('disabled', 'staging', 'active')) DEFAULT 'disabled',
  active_client_recipient TEXT,
  llg_copy_recipient TEXT,
  sender_address TEXT,
  allowed_origins TEXT NOT NULL DEFAULT '[]',
  phone_route_id TEXT,
  sms_capability TEXT NOT NULL CHECK (sms_capability IN ('disabled', 'approved')) DEFAULT 'disabled',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_delivery_audit (
  lead_id TEXT PRIMARY KEY,
  site_key TEXT NOT NULL,
  page_path TEXT NOT NULL,
  event_status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  error_code TEXT,
  received_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (site_key) REFERENCES site_routes(site_key)
);

CREATE INDEX IF NOT EXISTS lead_delivery_audit_site_status_idx
  ON lead_delivery_audit(site_key, event_status, updated_at);
