CREATE TABLE IF NOT EXISTS qr_scan_events (
  id          SERIAL PRIMARY KEY,
  "qrCodeId"  INTEGER NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  "productId" INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  "isAuthentic" BOOLEAN,
  "userAgent" TEXT,
  "scannedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_scan_events_product ON qr_scan_events ("productId");
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_qrcode  ON qr_scan_events ("qrCodeId");
