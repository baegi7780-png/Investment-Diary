-- Preserve stock IDs and all foreign keys in place. Original uniqueness and USD-only
-- columns become internal compatibility fields; the public market/currency fields
-- support native prices in all three markets.
ALTER TABLE stocks RENAME COLUMN ticker TO identity_key;
ALTER TABLE stocks RENAME COLUMN currency TO legacy_currency;
ALTER TABLE stocks ADD COLUMN ticker TEXT NOT NULL DEFAULT '';
ALTER TABLE stocks ADD COLUMN market TEXT NOT NULL DEFAULT 'US' CHECK(market IN ('US','KR','JP'));
ALTER TABLE stocks ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD','KRW','JPY'));
UPDATE stocks SET ticker=identity_key;
CREATE UNIQUE INDEX stock_market_ticker ON stocks(market,ticker);
CREATE TRIGGER stock_currency_guard BEFORE INSERT ON stocks
WHEN NOT ((NEW.market='US' AND NEW.currency='USD') OR (NEW.market='KR' AND NEW.currency='KRW') OR (NEW.market='JP' AND NEW.currency='JPY'))
BEGIN SELECT RAISE(ABORT,'시장과 거래 통화가 일치하지 않습니다'); END;
CREATE TABLE fx_rates (
  pair TEXT PRIMARY KEY CHECK(pair IN ('USD/KRW','JPY/KRW')),
  rate TEXT, rate_date TEXT, checked_at TEXT, last_attempt INTEGER NOT NULL DEFAULT 0,
  refresh_failed INTEGER NOT NULL DEFAULT 0 CHECK(refresh_failed IN (0,1))
);
INSERT INTO fx_rates SELECT * FROM exchange_rates;
INSERT INTO fx_rates(pair) VALUES ('JPY/KRW');
