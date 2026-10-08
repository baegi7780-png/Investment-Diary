CREATE TABLE peer_price_updates (
  owner_id TEXT NOT NULL REFERENCES users(id),
  stock_id TEXT NOT NULL REFERENCES stocks(id),
  editor_id TEXT NOT NULL REFERENCES users(id),
  price TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id,stock_id)
);
