CREATE TABLE exchange_rates (
  pair TEXT PRIMARY KEY CHECK(pair='USD/KRW'),
  rate TEXT, rate_date TEXT, checked_at TEXT,
  last_attempt INTEGER NOT NULL DEFAULT 0,
  refresh_failed INTEGER NOT NULL DEFAULT 0 CHECK(refresh_failed IN (0,1))
);
INSERT INTO exchange_rates(pair) VALUES ('USD/KRW');
